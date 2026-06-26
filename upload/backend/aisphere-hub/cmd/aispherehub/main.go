// Package main is the kratos+kit entry point for aisphere-hub backend.

package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	kratosstarter "github.com/actionlab-ai/aisphere-kit-kratos/starter"

	"aisphere-hub/internal/app"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	paths := configPaths()
	_, _ = fmt.Fprintf(os.Stderr, "aisphere-hub starting, config=%s\n", strings.Join(paths, ","))

	if err := kratosstarter.Serve(ctx, kratosstarter.ServeOptions{
		ConfigPaths: paths,
		NewApp:      app.NewApp,
	}); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "aisphere-hub startup failed: %v\n", err)
		os.Exit(1)
	}
}

func configPaths() []string {
	raw := strings.TrimSpace(os.Getenv("AISPHERE_CONFIG"))
	if raw == "" {
		return []string{"configs/config.yaml"}
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == ';' })
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return []string{"configs/config.yaml"}
	}
	return out
}
