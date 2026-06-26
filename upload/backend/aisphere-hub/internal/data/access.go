// Package data access wiring — exposes the reusable aisphere-kit access guard.
package data

import "github.com/actionlab-ai/aisphere-kit/access"

func NewAccessGuard(data *Data) *access.Guard {
	if data == nil || data.Runtime == nil {
		return access.NewGuard(access.Options{Component: "aisphere-hub"})
	}
	if data.Runtime.Access != nil {
		return data.Runtime.Access
	}
	return access.NewGuard(access.Options{
		Authz:        data.Runtime.Authz,
		Audit:        data.Runtime.Audit,
		AuthzEnabled: data.Runtime.Config != nil && data.Runtime.Config.Features.Authz,
		AuditEnabled: data.Runtime.Config != nil && data.Runtime.Config.Features.Audit,
		Logger:       data.Runtime.Logger,
		Component:    "aisphere-hub",
	})
}
