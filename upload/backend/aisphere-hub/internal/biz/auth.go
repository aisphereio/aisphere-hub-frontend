// Package biz auth module — Casdoor-native authentication usecase.
//
// Hub does not issue local tokens. This usecase orchestrates OAuth login URL
// construction, authorization-code exchange, refresh, and logout URL creation
// through a provider-neutral AuthRepo implemented in the data layer.
package biz

import (
	"context"
	"fmt"

	"github.com/actionlab-ai/aisphere-kit/access"
)

const (
	AuthActionLoginURL    = "auth.login_url"
	AuthActionExchange    = "auth.exchange"
	AuthActionRefresh     = "auth.refresh"
	AuthActionLogoutURL   = "auth.logout_url"
	AuthActionMe          = "auth.me"
	AuthActionCheckAdmin  = "auth.check_admin"
	AuthActionAuditTest   = "auth.audit_test"
	AuthResourceSession   = "aihub:auth:session"
	AuthResourceAdmin     = "aihub:admin"
	AuthActionAdminAccess = "admin.access"
)

type AuthLoginURLRequest struct {
	RedirectURI string
	State       string
	Scope       string
	Prompt      string
}

type AuthLogoutURLRequest struct {
	PostLogoutRedirectURI string
	IDTokenHint           string
	State                 string
}

type AuthExchangeRequest struct {
	Code        string
	RedirectURI string
	State       string
}

type AuthRefreshRequest struct {
	RefreshToken string
	Scope        string
}

type AuthToken struct {
	AccessToken  string
	RefreshToken string
	IDToken      string
	TokenType    string
	ExpiresIn    int64
	Scope        string
}

type AuthRepo interface {
	Authenticate(ctx context.Context, token string) (context.Context, error)
	LoginURL(ctx context.Context, req AuthLoginURLRequest) (string, error)
	LogoutURL(ctx context.Context, req AuthLogoutURLRequest) (string, error)
	Exchange(ctx context.Context, req AuthExchangeRequest) (*AuthToken, error)
	Refresh(ctx context.Context, req AuthRefreshRequest) (*AuthToken, error)
}

type AuthUsecase struct {
	repo   AuthRepo
	access *access.Guard
}

func NewAuthUsecase(repo AuthRepo, accessGuard *access.Guard) *AuthUsecase {
	return &AuthUsecase{repo: repo, access: accessGuard}
}

func (uc *AuthUsecase) AuthenticateBearer(ctx context.Context, token string) (context.Context, error) {
	if uc == nil || uc.repo == nil {
		return ctx, fmt.Errorf("auth repo is not configured")
	}
	return uc.repo.Authenticate(ctx, token)
}

func (uc *AuthUsecase) LoginURL(ctx context.Context, req AuthLoginURLRequest) (string, error) {
	url, err := uc.repo.LoginURL(ctx, req)
	uc.record(ctx, AuthActionLoginURL, err, map[string]string{
		"redirect_uri": req.RedirectURI,
		"state":        req.State,
	})
	return url, err
}

func (uc *AuthUsecase) LogoutURL(ctx context.Context, req AuthLogoutURLRequest) (string, error) {
	url, err := uc.repo.LogoutURL(ctx, req)
	uc.record(ctx, AuthActionLogoutURL, err, map[string]string{
		"post_logout_redirect_uri": req.PostLogoutRedirectURI,
		"state":                    req.State,
	})
	return url, err
}

func (uc *AuthUsecase) Exchange(ctx context.Context, req AuthExchangeRequest) (*AuthToken, error) {
	out, err := uc.repo.Exchange(ctx, req)
	uc.record(ctx, AuthActionExchange, err, map[string]string{
		"redirect_uri": req.RedirectURI,
		"state":        req.State,
	})
	return out, err
}

func (uc *AuthUsecase) Refresh(ctx context.Context, req AuthRefreshRequest) (*AuthToken, error) {
	out, err := uc.repo.Refresh(ctx, req)
	uc.record(ctx, AuthActionRefresh, err, nil)
	return out, err
}

func (uc *AuthUsecase) RecordMe(ctx context.Context) {
	uc.record(ctx, AuthActionMe, nil, nil)
}

type AccessStatus struct {
	AuthzEnabled bool
	AuditEnabled bool
}

type CheckAdminResult struct {
	AccessStatus
	Resource string
	Action   string
	Allowed  bool
}

type AuditTestResult struct {
	AccessStatus
	Action   string
	Resource string
	Recorded bool
}

func (uc *AuthUsecase) AccessStatus(ctx context.Context) AccessStatus {
	if uc == nil || uc.access == nil {
		return AccessStatus{}
	}
	return AccessStatus{AuthzEnabled: uc.access.AuthzEnabled(), AuditEnabled: uc.access.AuditEnabled()}
}

func (uc *AuthUsecase) CheckAdmin(ctx context.Context) (*CheckAdminResult, error) {
	status := uc.AccessStatus(ctx)
	result := &CheckAdminResult{
		AccessStatus: status,
		Resource:     AuthResourceAdmin,
		Action:       AuthActionAdminAccess,
	}
	if uc == nil || uc.access == nil {
		return result, nil
	}
	_, err := uc.access.Require(ctx, access.Check{
		Resource: AuthResourceAdmin,
		Action:   AuthActionAdminAccess,
	})
	result.Allowed = err == nil
	uc.record(ctx, AuthActionCheckAdmin, err, map[string]string{
		"required_resource": AuthResourceAdmin,
		"required_action":   AuthActionAdminAccess,
		"authz_enabled":     fmt.Sprintf("%t", status.AuthzEnabled),
	})
	return result, err
}

func (uc *AuthUsecase) AuditTest(ctx context.Context) (*AuditTestResult, error) {
	status := uc.AccessStatus(ctx)
	result := &AuditTestResult{
		AccessStatus: status,
		Action:       AuthActionAuditTest,
		Resource:     AuthResourceSession,
		Recorded:     status.AuditEnabled,
	}
	if uc == nil || uc.access == nil {
		return result, nil
	}
	err := uc.access.Record(ctx, access.Event{
		Name:      fmt.Sprintf("%s:%s", AuthActionAuditTest, AuthResourceSession),
		Action:    AuthActionAuditTest,
		Resource:  AuthResourceSession,
		Result:    access.ResultSuccess,
		Component: "aisphere-hub",
	})
	return result, err
}

func (uc *AuthUsecase) record(ctx context.Context, action string, err error, metadata map[string]string) {
	if uc == nil || uc.access == nil {
		return
	}
	result := access.ResultSuccess
	message := ""
	if err != nil {
		result = access.ResultFailed
		message = err.Error()
	}
	_ = uc.access.Record(ctx, access.Event{
		Name:      fmt.Sprintf("%s:%s", action, AuthResourceSession),
		Action:    action,
		Resource:  AuthResourceSession,
		Result:    result,
		Message:   message,
		Component: "aisphere-hub",
		Metadata:  metadata,
	})
}
