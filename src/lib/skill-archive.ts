const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2000;

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_FILE_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_UTF8_FLAG = 0x0800;

const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();

export type SkillArchiveMetadata = {
  name: string;
  displayName: string;
  description: string;
};

export type SkillArchiveFile = {
  path: string;
  content: Uint8Array;
};

export type SkillArchivePreview = SkillArchiveMetadata & {
  files: SkillArchiveFile[];
  fileCount: number;
  unpackedSize: number;
};

export async function inspectSkillArchive(
  input: ArrayBuffer | Uint8Array,
): Promise<SkillArchivePreview> {
  const archiveBytes = toBytes(input);
  if (archiveBytes.byteLength === 0) {
    throw new Error('ZIP 文件不能为空');
  }
  if (archiveBytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('ZIP 文件不能超过 50 MB');
  }

  const files = normalizeSkillRoot(await readZipFiles(archiveBytes));
  const skillFile = files.find((file) => file.path === 'SKILL.md');
  if (!skillFile) {
    throw new Error('ZIP 中必须包含 SKILL.md');
  }

  const document = decodeText(skillFile.content, 'SKILL.md');
  const metadata = parseSkillMetadata(document);
  return {
    ...metadata,
    files,
    fileCount: files.length,
    unpackedSize: files.reduce((sum, file) => sum + file.content.byteLength, 0),
  };
}

export async function buildSkillArchive(
  preview: SkillArchivePreview,
  metadata: SkillArchiveMetadata,
): Promise<Uint8Array> {
  const name = metadata.name.trim();
  const description = metadata.description.trim();
  const displayName = metadata.displayName.trim() || name;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) {
    throw new Error('Skill Name 只能包含字母、数字、点、下划线和短横线，最长 128 个字符');
  }
  if (!description) {
    throw new Error('Skill 描述不能为空');
  }

  const files: SkillArchiveFile[] = preview.files.map((file) => ({
    path: file.path,
    content: file.content.slice(),
  }));
  const skillIndex = files.findIndex((file) => file.path === 'SKILL.md');
  if (skillIndex < 0) {
    throw new Error('ZIP 中必须包含 SKILL.md');
  }

  const current = decodeText(files[skillIndex].content, 'SKILL.md');
  files[skillIndex] = {
    path: 'SKILL.md',
    content: textEncoder.encode(
      rewriteSkillMetadata(current, { name, displayName, description }),
    ),
  };

  return writeZipFiles(files);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function readZipFiles(bytes: Uint8Array): Promise<SkillArchiveFile[]> {
  const view = dataView(bytes);
  const eocdOffset = findEndOfCentralDirectory(view);
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('不支持分卷 ZIP 文件');
  }
  if (entryCount > MAX_FILES) {
    throw new Error(`ZIP 文件数量不能超过 ${MAX_FILES}`);
  }
  if (centralOffset + centralSize > eocdOffset) {
    throw new Error('ZIP 中央目录损坏');
  }

  const files: SkillArchiveFile[] = [];
  const seen = new Set<string>();
  let offset = centralOffset;
  let totalSize = 0;

  for (let index = 0; index < entryCount; index += 1) {
    ensureRange(bytes, offset, 46, 'ZIP 中央目录损坏');
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_FILE_HEADER) {
      throw new Error('ZIP 中央目录损坏');
    }

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const expectedCrc = view.getUint32(offset + 16, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const localOffset = view.getUint32(offset + 42, true);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    ensureRange(bytes, offset, recordLength, 'ZIP 中央目录损坏');

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      throw new Error('暂不支持 ZIP64 文件');
    }
    if ((flags & 0x0001) !== 0) {
      throw new Error('不支持加密 ZIP 文件');
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`ZIP 使用了不支持的压缩算法：${method}`);
    }

    const unixMode = externalAttributes >>> 16;
    if ((unixMode & 0o170000) === 0o120000) {
      throw new Error('ZIP 中不能包含符号链接');
    }

    const rawName = decodeText(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
      'ZIP 文件名',
    );
    offset += recordLength;
    if (rawName.endsWith('/')) {
      continue;
    }

    const path = normalizeArchivePath(rawName);
    if (isIgnoredArchiveFile(path)) {
      continue;
    }
    if (seen.has(path)) {
      throw new Error(`ZIP 中存在重复文件：${path}`);
    }
    seen.add(path);
    if (files.length + 1 > MAX_FILES) {
      throw new Error(`ZIP 文件数量不能超过 ${MAX_FILES}`);
    }
    if (uncompressedSize > MAX_FILE_BYTES) {
      throw new Error(`文件 ${path} 不能超过 50 MB`);
    }
    totalSize += uncompressedSize;
    if (totalSize > MAX_UNPACKED_BYTES) {
      throw new Error('ZIP 解压后不能超过 200 MB');
    }

    ensureRange(bytes, localOffset, 30, `ZIP 文件头损坏：${path}`);
    if (view.getUint32(localOffset, true) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error(`ZIP 文件头损坏：${path}`);
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    ensureRange(bytes, dataOffset, compressedSize, `ZIP 文件内容损坏：${path}`);

    const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
    const content =
      method === 0 ? compressed.slice() : await inflateRaw(compressed, path);
    if (content.byteLength !== uncompressedSize) {
      throw new Error(`ZIP 文件大小校验失败：${path}`);
    }
    if (crc32(content) !== expectedCrc) {
      throw new Error(`ZIP 文件 CRC 校验失败：${path}`);
    }
    files.push({ path, content });
  }

  return files;
}

function normalizeSkillRoot(files: SkillArchiveFile[]): SkillArchiveFile[] {
  if (files.some((file) => file.path === 'SKILL.md')) {
    return files;
  }

  const wrappers = new Set(
    files
      .filter((file) => /^[^/]+\/SKILL\.md$/.test(file.path))
      .map((file) => file.path.slice(0, file.path.indexOf('/'))),
  );
  if (wrappers.size === 0) {
    throw new Error('ZIP 中必须包含 SKILL.md');
  }
  if (wrappers.size > 1) {
    throw new Error('ZIP 中包含多个顶层 SKILL.md');
  }

  const wrapper = [...wrappers][0];
  const prefix = `${wrapper}/`;
  if (files.some((file) => !file.path.startsWith(prefix))) {
    throw new Error('ZIP 中的所有文件必须位于包含 SKILL.md 的同一个顶层目录');
  }
  return files.map((file) => ({
    path: file.path.slice(prefix.length),
    content: file.content,
  }));
}

function parseSkillMetadata(document: string): SkillArchiveMetadata {
  const parsed = splitFrontMatter(document);
  const name = readYamlString(parsed.frontMatter, 'name').trim();
  const description = readYamlString(parsed.frontMatter, 'description').trim();
  const displayName =
    readYamlString(parsed.frontMatter, 'display_name').trim() ||
    readYamlString(parsed.frontMatter, 'title').trim() ||
    firstMarkdownHeading(parsed.body) ||
    name;
  return { name, displayName, description };
}

function rewriteSkillMetadata(
  document: string,
  metadata: SkillArchiveMetadata,
): string {
  const parsed = splitFrontMatter(document);
  let frontMatter = parsed.frontMatter.slice();
  frontMatter = upsertYamlString(frontMatter, 'name', metadata.name);
  frontMatter = upsertYamlString(
    frontMatter,
    'display_name',
    metadata.displayName || metadata.name,
  );
  frontMatter = upsertYamlString(
    frontMatter,
    'description',
    metadata.description,
  );
  return `---\n${frontMatter.join('\n')}\n---${parsed.body ? `\n${parsed.body}` : '\n'}`;
}

function splitFrontMatter(document: string): {
  frontMatter: string[];
  body: string;
} {
  const normalized = document
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') {
    throw new Error('SKILL.md 必须以 YAML Front Matter 开头');
  }
  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === '---',
  );
  if (end < 0) {
    throw new Error('SKILL.md 的 YAML Front Matter 未闭合');
  }
  return {
    frontMatter: lines.slice(1, end),
    body: lines.slice(end + 1).join('\n'),
  };
}

function readYamlString(lines: string[], key: string): string {
  const range = findYamlField(lines, key);
  if (!range) {
    return '';
  }
  const first = lines[range.start];
  const raw = first.slice(first.indexOf(':') + 1).trim();
  if (/^[|>][+-]?\s*(?:#.*)?$/.test(raw)) {
    const folded = raw.startsWith('>');
    const content = lines.slice(range.start + 1, range.end);
    const indent = content.reduce((current, line) => {
      if (!line.trim()) return current;
      const match = line.match(/^\s*/)?.[0].length ?? 0;
      return current === 0 ? match : Math.min(current, match);
    }, 0);
    const unindented = content.map((line) => line.slice(indent));
    return folded ? foldYamlLines(unindented) : unindented.join('\n');
  }
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, raw.lastIndexOf('"'));
    }
  }
  if (raw.startsWith("'") && raw.lastIndexOf("'") > 0) {
    return raw.slice(1, raw.lastIndexOf("'")).replace(/''/g, "'");
  }
  return stripYamlInlineComment(raw).trim();
}

function upsertYamlString(
  lines: string[],
  key: string,
  value: string,
): string[] {
  const replacement = `${key}: ${JSON.stringify(value)}`;
  const range = findYamlField(lines, key);
  if (!range) {
    return [...lines, replacement];
  }
  return [
    ...lines.slice(0, range.start),
    replacement,
    ...lines.slice(range.end),
  ];
}

function findYamlField(
  lines: string[],
  key: string,
): { start: number; end: number } | null {
  const matcher = new RegExp(`^${escapeRegExp(key)}\\s*:`);
  const start = lines.findIndex((line) => matcher.test(line));
  if (start < 0) {
    return null;
  }
  const raw = lines[start].slice(lines[start].indexOf(':') + 1).trim();
  if (!/^[|>][+-]?\s*(?:#.*)?$/.test(raw)) {
    return { start, end: start + 1 };
  }
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() && !/^\s/.test(line)) {
      break;
    }
    end += 1;
  }
  return { start, end };
}

function foldYamlLines(lines: string[]): string {
  let output = '';
  for (const line of lines) {
    if (!line) {
      output += '\n';
      continue;
    }
    if (output && !output.endsWith('\n')) {
      output += ' ';
    }
    output += line;
  }
  return output;
}

function stripYamlInlineComment(value: string): string {
  const index = value.search(/\s+#/);
  return index >= 0 ? value.slice(0, index) : value;
}

function firstMarkdownHeading(body: string): string {
  for (const line of body.split('\n')) {
    const match = line.trim().match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return '';
}

async function writeZipFiles(files: SkillArchiveFile[]): Promise<Uint8Array> {
  if (files.length > MAX_FILES) {
    throw new Error(`ZIP 文件数量不能超过 ${MAX_FILES}`);
  }

  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let localOffset = 0;
  let totalUnpacked = 0;

  for (const file of files) {
    const path = normalizeArchivePath(file.path);
    const name = textEncoder.encode(path);
    const content = file.content;
    if (content.byteLength > MAX_FILE_BYTES) {
      throw new Error(`文件 ${path} 不能超过 50 MB`);
    }
    totalUnpacked += content.byteLength;
    if (totalUnpacked > MAX_UNPACKED_BYTES) {
      throw new Error('ZIP 解压后不能超过 200 MB');
    }

    const compressed = await maybeDeflateRaw(content);
    const method = compressed.byteLength < content.byteLength ? 8 : 0;
    const payload = method === 8 ? compressed : content;
    const checksum = crc32(content);

    const localHeader = new Uint8Array(30 + name.byteLength);
    const localView = dataView(localHeader);
    localView.setUint32(0, ZIP_LOCAL_FILE_HEADER, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, ZIP_UTF8_FLAG, true);
    localView.setUint16(8, method, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 33, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, payload.byteLength, true);
    localView.setUint32(22, content.byteLength, true);
    localView.setUint16(26, name.byteLength, true);
    localView.setUint16(28, 0, true);
    localHeader.set(name, 30);
    localRecords.push(localHeader, payload);

    const centralHeader = new Uint8Array(46 + name.byteLength);
    const centralView = dataView(centralHeader);
    centralView.setUint32(0, ZIP_CENTRAL_FILE_HEADER, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, ZIP_UTF8_FLAG, true);
    centralView.setUint16(10, method, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, payload.byteLength, true);
    centralView.setUint32(24, content.byteLength, true);
    centralView.setUint16(28, name.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0o100644 << 16, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(name, 46);
    centralRecords.push(centralHeader);

    localOffset += localHeader.byteLength + payload.byteLength;
  }

  const centralSize = centralRecords.reduce(
    (sum, record) => sum + record.byteLength,
    0,
  );
  const eocd = new Uint8Array(22);
  const eocdView = dataView(eocd);
  eocdView.setUint32(0, ZIP_END_OF_CENTRAL_DIRECTORY, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, localOffset, true);
  eocdView.setUint16(20, 0, true);

  const archive = concatBytes([...localRecords, ...centralRecords, eocd]);
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error('修改后的 ZIP 文件超过 50 MB');
  }
  return archive;
}

async function inflateRaw(
  compressed: Uint8Array,
  path: string,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(`当前浏览器无法解压文件：${path}`);
  }
  try {
    const stream = new Blob([arrayBufferOf(compressed)])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error(`ZIP 文件解压失败：${path}`);
  }
}

async function maybeDeflateRaw(content: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined' || content.byteLength === 0) {
    return content;
  }
  try {
    const stream = new Blob([arrayBufferOf(content)])
      .stream()
      .pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return content;
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== ZIP_END_OF_CENTRAL_DIRECTORY) {
      continue;
    }
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === view.byteLength) {
      return offset;
    }
  }
  throw new Error('文件不是有效的 ZIP 格式');
}

function normalizeArchivePath(raw: string): string {
  const normalized = raw.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes(':')) {
    throw new Error(`ZIP 中包含非法路径：${raw}`);
  }
  const parts: string[] = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      throw new Error(`ZIP 中包含路径穿越：${raw}`);
    }
    parts.push(part);
  }
  const path = parts.join('/');
  if (!path) {
    throw new Error(`ZIP 中包含非法路径：${raw}`);
  }
  if (parts.some((part) => part === '.git')) {
    throw new Error(`ZIP 中不能包含 .git 路径：${path}`);
  }
  return path;
}

function isIgnoredArchiveFile(path: string): boolean {
  return (
    path === '.DS_Store' ||
    path.endsWith('/.DS_Store') ||
    path.startsWith('__MACOSX/')
  );
}

function decodeText(bytes: Uint8Array, label: string): string {
  try {
    return textDecoder.decode(bytes);
  } catch {
    throw new Error(`${label} 不是有效的 UTF-8 文本`);
  }
}

function toBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function ensureRange(
  bytes: Uint8Array,
  offset: number,
  length: number,
  message: string,
): void {
  if (
    offset < 0 ||
    length < 0 ||
    offset > bytes.byteLength ||
    length > bytes.byteLength - offset
  ) {
    throw new Error(message);
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) {
      current =
        (current & 1) !== 0
          ? 0xedb88320 ^ (current >>> 1)
          : current >>> 1;
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
