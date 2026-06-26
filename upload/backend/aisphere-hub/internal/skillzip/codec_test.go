package skillzip

import (
	"archive/zip"
	"bytes"
	"testing"
)

func TestParseSkillFromZipRootlessPackage(t *testing.T) {
	got, err := ParseSkillFromZip(testZip(t, map[string]string{
		SkillMDFile:       "---\nname: demo\ndescription: Demo\nversion: 0.1.0\n---\nUse it.",
		"prompts/main.md": "Prompt body",
	}))
	if err != nil {
		t.Fatalf("ParseSkillFromZip() error = %v", err)
	}
	if got.Name != "demo" || got.Version != "0.1.0" {
		t.Fatalf("ParseSkillFromZip() = %#v, want demo@0.1.0", got)
	}
	if len(got.Resources) != 1 || got.Resources[0].Path != "prompts/main.md" {
		t.Fatalf("resources = %#v, want rootless prompt path", got.Resources)
	}
}

func testZip(t *testing.T, files map[string]string) []byte {
	t.Helper()
	buf := bytes.NewBuffer(nil)
	zw := zip.NewWriter(buf)
	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
