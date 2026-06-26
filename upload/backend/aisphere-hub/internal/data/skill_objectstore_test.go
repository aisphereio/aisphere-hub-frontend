package data

import (
	"context"
	"io"
	"net/url"
	"reflect"
	"testing"
	"time"

	"aisphere-hub/internal/biz"

	"github.com/actionlab-ai/aisphere-kit/objectstore"
)

func TestStoreSkillPackageObjectsUsesKitObjectstore(t *testing.T) {
	s3 := &fakeObjectstore{bucket: "aihub"}
	refs, err := storeSkillPackageObjects(context.Background(), s3, &biz.Skill{Name: "demo-skill"}, &biz.SkillVersion{SkillName: "demo-skill", Version: "0.1.0"}, []*biz.SkillFile{
		{Path: "SKILL.md", Content: "skill body"},
		{Path: "prompts/main.md", Content: "prompt"},
	}, []byte("zip-bytes"))
	if err != nil {
		t.Fatalf("storeSkillPackageObjects() error = %v", err)
	}

	if refs.PackageKey != "skills/demo-skill/versions/0.1.0/package.zip" {
		t.Fatalf("PackageKey = %q", refs.PackageKey)
	}
	if refs.PackageURI != "objectstore://aihub/skills/demo-skill/versions/0.1.0/package.zip" {
		t.Fatalf("PackageURI = %q", refs.PackageURI)
	}
	wantKeys := []string{
		"skills/demo-skill/versions/0.1.0/package.zip",
		"skills/demo-skill/versions/0.1.0/files/SKILL.md",
		"skills/demo-skill/versions/0.1.0/files/prompts/main.md",
	}
	if got := s3.keys(); !reflect.DeepEqual(got, wantKeys) {
		t.Fatalf("PutObject keys = %#v, want %#v", got, wantKeys)
	}
	if refs.FileKeys["prompts/main.md"] != "skills/demo-skill/versions/0.1.0/files/prompts/main.md" {
		t.Fatalf("FileKeys = %#v", refs.FileKeys)
	}
}

type fakeObjectstore struct {
	bucket string
	puts   []fakePut
}

type fakePut struct {
	key         string
	contentType string
	body        string
}

func (f *fakeObjectstore) keys() []string {
	out := make([]string, 0, len(f.puts))
	for _, put := range f.puts {
		out = append(out, put.key)
	}
	return out
}

func (f *fakeObjectstore) Bucket() string { return f.bucket }
func (f *fakeObjectstore) BucketExists(context.Context) (bool, error) {
	return true, nil
}
func (f *fakeObjectstore) EnsureBucket(context.Context) error { return nil }
func (f *fakeObjectstore) PutObject(_ context.Context, key string, body io.Reader, size int64, opts objectstore.PutOptions) (objectstore.ObjectInfo, error) {
	b, err := io.ReadAll(body)
	if err != nil {
		return objectstore.ObjectInfo{}, err
	}
	f.puts = append(f.puts, fakePut{key: key, contentType: opts.ContentType, body: string(b)})
	return objectstore.ObjectInfo{Bucket: f.bucket, Key: key, Size: size, ContentType: opts.ContentType}, nil
}
func (f *fakeObjectstore) GetObject(context.Context, string, objectstore.GetOptions) (io.ReadCloser, objectstore.ObjectInfo, error) {
	panic("not used")
}
func (f *fakeObjectstore) DeleteObject(context.Context, string) error { panic("not used") }
func (f *fakeObjectstore) StatObject(context.Context, string) (objectstore.ObjectInfo, error) {
	panic("not used")
}
func (f *fakeObjectstore) ListObjects(context.Context, objectstore.ListOptions) ([]objectstore.ObjectInfo, error) {
	panic("not used")
}
func (f *fakeObjectstore) CopyObject(context.Context, string, string, objectstore.PutOptions) (objectstore.ObjectInfo, error) {
	panic("not used")
}
func (f *fakeObjectstore) PresignPut(context.Context, string, time.Duration) (*url.URL, error) {
	panic("not used")
}
func (f *fakeObjectstore) PresignGet(context.Context, string, time.Duration) (*url.URL, error) {
	panic("not used")
}
