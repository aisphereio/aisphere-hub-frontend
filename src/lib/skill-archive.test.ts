import { describe, expect, it } from 'vitest';
import {
  buildSkillArchive,
  inspectSkillArchive,
  type SkillArchiveFile,
  type SkillArchivePreview,
} from './skill-archive';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function preview(files: Record<string, string>): SkillArchivePreview {
  const entries: SkillArchiveFile[] = Object.entries(files).map(
    ([path, content]) => ({ path, content: encoder.encode(content) }),
  );
  return {
    name: 'seed',
    displayName: 'Seed',
    description: 'Seed description',
    files: entries,
    fileCount: entries.length,
    unpackedSize: entries.reduce(
      (sum, entry) => sum + entry.content.byteLength,
      0,
    ),
  };
}

describe('skill archive', () => {
  it('reads metadata from a root SKILL.md', async () => {
    const archive = await buildSkillArchive(
      preview({
        'SKILL.md': '---\nname: seed\ndescription: seed\n---\n# Seed\n',
        'src/main.py': 'print("ok")\n',
      }),
      {
        name: 'search',
        displayName: 'Search Skill',
        description: 'Search tools',
      },
    );

    const result = await inspectSkillArchive(archive);
    expect(result).toMatchObject({
      name: 'search',
      displayName: 'Search Skill',
      description: 'Search tools',
      fileCount: 2,
    });
  });

  it('accepts and strips one top-level wrapper directory', async () => {
    const archive = createStoredZip({
      'search-skill/SKILL.md':
        '---\nname: search\ntitle: Search Skill\ndescription: Search tools\n---\n',
      'search-skill/src/main.py': 'print("ok")\n',
      '__MACOSX/._SKILL.md': 'ignored',
    });

    const result = await inspectSkillArchive(archive);
    expect(result.files.map((file) => file.path)).toEqual([
      'SKILL.md',
      'src/main.py',
    ]);
    expect(result.displayName).toBe('Search Skill');
  });

  it('rejects an archive without SKILL.md', async () => {
    const archive = createStoredZip({ 'README.md': '# Missing' });
    await expect(inspectSkillArchive(archive)).rejects.toThrow('SKILL.md');
  });

  it('writes edited metadata back to SKILL.md and preserves other files', async () => {
    const original = await inspectSkillArchive(
      createStoredZip({
        'SKILL.md':
          '---\nname: old\ndescription: old description\nlicense: Apache-2.0\n---\n# Old\n',
        'src/main.py': 'print("ok")\n',
      }),
    );

    const archive = await buildSkillArchive(original, {
      name: 'new-name',
      displayName: 'New Name',
      description: 'New description',
    });
    const result = await inspectSkillArchive(archive);
    expect(result).toMatchObject({
      name: 'new-name',
      displayName: 'New Name',
      description: 'New description',
    });
    expect(
      decoder.decode(
        result.files.find((file) => file.path === 'src/main.py')?.content,
      ),
    ).toBe('print("ok")\n');
    expect(
      decoder.decode(
        result.files.find((file) => file.path === 'SKILL.md')?.content,
      ),
    ).toContain('license: Apache-2.0');
  });
});

function createStoredZip(files: Record<string, string>): Uint8Array {
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;

  for (const [path, source] of Object.entries(files)) {
    const name = encoder.encode(path);
    const content = encoder.encode(source);
    const checksum = crc32(content);

    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    localRecords.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(38, 0o100644 << 16, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralRecords.push(central);
    localOffset += local.length;
  }

  const centralSize = centralRecords.reduce(
    (sum, record) => sum + record.length,
    0,
  );
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, centralRecords.length, true);
  view.setUint16(10, centralRecords.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, localOffset, true);

  return concat([...localRecords, ...centralRecords, eocd]);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) {
      current =
        current & 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
    }
    table[value] = current >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
