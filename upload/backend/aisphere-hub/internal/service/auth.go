// Package service auth module — Kratos handlers for Casdoor-native auth.

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	stdhttp "net/http"
	"strings"

	v1 "aisphere-hub/api/auth/v1"
	"aisphere-hub/internal/biz"

	"github.com/actionlab-ai/aisphere-kit/principal"
	khttp "github.com/go-kratos/kratos/v3/transport/http"
)

type AuthService struct {
	uc *biz.AuthUsecase
}

func NewAuthService(uc *biz.AuthUsecase) *AuthService {
	return &AuthService{uc: uc}
}

func (s *AuthService) RegisterHTTPServer(srv *khttp.Server) {
	// Register generated endpoints for login-url/logout-url/me.
	// Exchange/Refresh HTTP endpoints are registered manually below because the
	// Kratos JSON body binding used in the current toolchain only accepts the
	// proto field name in some cases. Manual handlers let us accept both:
	//   redirect_uri and redirectUri
	//   refresh_token and refreshToken
	v1.RegisterAuthServiceHTTPServer(srv, s)

	// Browser-friendly endpoints. These intentionally return HTTP 302 instead
	// of JSON so users never copy a JSON-escaped URL with \u0026 into the browser.
	srv.HandleFunc("/v3/auth/login", s.handleLoginRedirect)
	srv.HandleFunc("/v3/auth/logout", s.handleLogoutRedirect)

	// SPA/backend-friendly JSON endpoints with robust body decoding.
	srv.HandleFunc("/v3/auth/exchange", s.handleExchangeHTTP)
	srv.HandleFunc("/v3/auth/refresh", s.handleRefreshHTTP)

	// Dev-only authz/audit verification endpoints were removed from the default
	// route set. Real business routes, starting with SkillService, are now the
	// verification path for access.Require and access.Record.
}

func (s *AuthService) LoginURL(ctx context.Context, req *v1.LoginURLRequest) (*v1.LoginURLResponse, error) {
	url, err := s.uc.LoginURL(ctx, biz.AuthLoginURLRequest{
		RedirectURI: req.GetRedirectUri(),
		State:       req.GetState(),
		Scope:       req.GetScope(),
		Prompt:      req.GetPrompt(),
	})
	if err != nil {
		return nil, err
	}
	return &v1.LoginURLResponse{LoginUrl: url}, nil
}

func (s *AuthService) Exchange(ctx context.Context, req *v1.ExchangeRequest) (*v1.TokenResponse, error) {
	out, err := s.uc.Exchange(ctx, biz.AuthExchangeRequest{
		Code:        req.GetCode(),
		RedirectURI: req.GetRedirectUri(),
		State:       req.GetState(),
	})
	if err != nil {
		return nil, err
	}
	return tokenDOToDTO(out), nil
}

func (s *AuthService) Refresh(ctx context.Context, req *v1.RefreshRequest) (*v1.TokenResponse, error) {
	out, err := s.uc.Refresh(ctx, biz.AuthRefreshRequest{
		RefreshToken: req.GetRefreshToken(),
		Scope:        req.GetScope(),
	})
	if err != nil {
		return nil, err
	}
	return tokenDOToDTO(out), nil
}

func (s *AuthService) LogoutURL(ctx context.Context, req *v1.LogoutURLRequest) (*v1.LogoutURLResponse, error) {
	url, err := s.uc.LogoutURL(ctx, biz.AuthLogoutURLRequest{
		PostLogoutRedirectURI: req.GetPostLogoutRedirectUri(),
		IDTokenHint:           req.GetIdTokenHint(),
		State:                 req.GetState(),
	})
	if err != nil {
		return nil, err
	}
	return &v1.LogoutURLResponse{LogoutUrl: url}, nil
}

func (s *AuthService) Me(ctx context.Context, req *v1.MeRequest) (*v1.MeResponse, error) {
	p, err := principal.RequireFromContext(ctx)
	if err != nil {
		return nil, err
	}
	s.uc.RecordMe(ctx)
	return &v1.MeResponse{
		SubjectType: p.SubjectType,
		SubjectId:   p.SubjectID,
		Name:        p.Name,
		DisplayName: p.DisplayName,
		Email:       p.Email,
		Avatar:      p.Avatar,
		OrgId:       p.OrgID,
		ProjectId:   p.ProjectID,
		Roles:       append([]string(nil), p.Roles...),
		Groups:      append([]string(nil), p.Groups...),
	}, nil
}

func (s *AuthService) handleLoginRedirect(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	q := r.URL.Query()
	url, err := s.uc.LoginURL(r.Context(), biz.AuthLoginURLRequest{
		RedirectURI: firstNonEmpty(q.Get("redirect_uri"), q.Get("redirectUri")),
		State:       q.Get("state"),
		Scope:       q.Get("scope"),
		Prompt:      q.Get("prompt"),
	})
	if err != nil {
		writeError(w, stdhttp.StatusBadRequest, err)
		return
	}
	stdhttp.Redirect(w, r, url, stdhttp.StatusFound)
}

func (s *AuthService) handleLogoutRedirect(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	q := r.URL.Query()
	url, err := s.uc.LogoutURL(r.Context(), biz.AuthLogoutURLRequest{
		PostLogoutRedirectURI: firstNonEmpty(q.Get("post_logout_redirect_uri"), q.Get("postLogoutRedirectUri")),
		IDTokenHint:           firstNonEmpty(q.Get("id_token_hint"), q.Get("idTokenHint")),
		State:                 q.Get("state"),
	})
	if err != nil {
		writeError(w, stdhttp.StatusBadRequest, err)
		return
	}
	stdhttp.Redirect(w, r, url, stdhttp.StatusFound)
}

func (s *AuthService) handleExchangeHTTP(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	if r.Method != stdhttp.MethodPost {
		writeError(w, stdhttp.StatusMethodNotAllowed, fmt.Errorf("method %s is not allowed", r.Method))
		return
	}
	var req exchangeJSONRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, stdhttp.StatusBadRequest, err)
		return
	}
	redirectURI := firstNonEmpty(req.RedirectURI, req.RedirectURICompat)
	if req.Code == "" {
		writeError(w, stdhttp.StatusBadRequest, fmt.Errorf("code is required"))
		return
	}
	if redirectURI == "" {
		writeError(w, stdhttp.StatusBadRequest, fmt.Errorf("redirect_uri is required"))
		return
	}
	out, err := s.uc.Exchange(r.Context(), biz.AuthExchangeRequest{
		Code:        req.Code,
		RedirectURI: redirectURI,
		State:       req.State,
	})
	if err != nil {
		writeError(w, stdhttp.StatusBadGateway, err)
		return
	}
	writeJSON(w, stdhttp.StatusOK, tokenDOToDTO(out))
}

func (s *AuthService) handleAccessStatusHTTP(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	if r.Method != stdhttp.MethodGet {
		writeError(w, stdhttp.StatusMethodNotAllowed, fmt.Errorf("method %s is not allowed", r.Method))
		return
	}
	status := s.uc.AccessStatus(r.Context())
	writeJSON(w, stdhttp.StatusOK, map[string]any{
		"ok":            true,
		"authz_enabled": status.AuthzEnabled,
		"audit_enabled": status.AuditEnabled,
	})
}

func (s *AuthService) handleCheckAdminHTTP(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	if r.Method != stdhttp.MethodGet {
		writeError(w, stdhttp.StatusMethodNotAllowed, fmt.Errorf("method %s is not allowed", r.Method))
		return
	}
	ctx, err := s.contextWithBearerPrincipal(r)
	if err != nil {
		writeJSON(w, stdhttp.StatusUnauthorized, map[string]any{
			"ok":            false,
			"allowed":       false,
			"authz_enabled": false,
			"audit_enabled": false,
			"resource":      biz.AuthResourceAdmin,
			"action":        biz.AuthActionAdminAccess,
			"message":       err.Error(),
		})
		return
	}
	result, err := s.uc.CheckAdmin(ctx)
	if err != nil {
		writeJSON(w, stdhttp.StatusForbidden, map[string]any{
			"ok":            false,
			"allowed":       false,
			"authz_enabled": result != nil && result.AuthzEnabled,
			"audit_enabled": result != nil && result.AuditEnabled,
			"resource":      biz.AuthResourceAdmin,
			"action":        biz.AuthActionAdminAccess,
			"message":       err.Error(),
		})
		return
	}
	writeJSON(w, stdhttp.StatusOK, map[string]any{
		"ok":            true,
		"allowed":       result == nil || result.Allowed,
		"authz_enabled": result != nil && result.AuthzEnabled,
		"audit_enabled": result != nil && result.AuditEnabled,
		"resource":      biz.AuthResourceAdmin,
		"action":        biz.AuthActionAdminAccess,
	})
}

func (s *AuthService) handleAuditTestHTTP(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	if r.Method != stdhttp.MethodPost {
		writeError(w, stdhttp.StatusMethodNotAllowed, fmt.Errorf("method %s is not allowed", r.Method))
		return
	}
	ctx, err := s.contextWithBearerPrincipal(r)
	if err != nil {
		writeJSON(w, stdhttp.StatusUnauthorized, map[string]any{
			"ok":            false,
			"recorded":      false,
			"authz_enabled": false,
			"audit_enabled": false,
			"action":        biz.AuthActionAuditTest,
			"resource":      biz.AuthResourceSession,
			"message":       err.Error(),
		})
		return
	}
	result, err := s.uc.AuditTest(ctx)
	if err != nil {
		writeError(w, stdhttp.StatusInternalServerError, err)
		return
	}
	writeJSON(w, stdhttp.StatusOK, map[string]any{
		"ok":            true,
		"recorded":      result != nil && result.Recorded,
		"authz_enabled": result != nil && result.AuthzEnabled,
		"audit_enabled": result != nil && result.AuditEnabled,
		"action":        biz.AuthActionAuditTest,
		"resource":      biz.AuthResourceSession,
	})
}

func (s *AuthService) handleRefreshHTTP(w stdhttp.ResponseWriter, r *stdhttp.Request) {
	if r.Method != stdhttp.MethodPost {
		writeError(w, stdhttp.StatusMethodNotAllowed, fmt.Errorf("method %s is not allowed", r.Method))
		return
	}
	var req refreshJSONRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, stdhttp.StatusBadRequest, err)
		return
	}
	refreshToken := firstNonEmpty(req.RefreshToken, req.RefreshTokenCompat)
	if refreshToken == "" {
		writeError(w, stdhttp.StatusBadRequest, fmt.Errorf("refresh_token is required"))
		return
	}
	out, err := s.uc.Refresh(r.Context(), biz.AuthRefreshRequest{
		RefreshToken: refreshToken,
		Scope:        req.Scope,
	})
	if err != nil {
		writeError(w, stdhttp.StatusBadGateway, err)
		return
	}
	writeJSON(w, stdhttp.StatusOK, tokenDOToDTO(out))
}

func (s *AuthService) contextWithBearerPrincipal(r *stdhttp.Request) (context.Context, error) {
	if p, ok := principal.FromContext(r.Context()); ok && p != nil && !p.IsZero() {
		return r.Context(), nil
	}
	token, ok := extractBearerHeader(r.Header.Get("Authorization"))
	if !ok {
		return r.Context(), fmt.Errorf("missing bearer token")
	}
	return s.uc.AuthenticateBearer(r.Context(), token)
}

func extractBearerHeader(header string) (string, bool) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", false
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") && strings.TrimSpace(parts[1]) != "" {
		return strings.TrimSpace(parts[1]), true
	}
	return "", false
}

type exchangeJSONRequest struct {
	Code              string `json:"code"`
	RedirectURI       string `json:"redirect_uri"`
	RedirectURICompat string `json:"redirectUri"`
	State             string `json:"state"`
}

type refreshJSONRequest struct {
	RefreshToken       string `json:"refresh_token"`
	RefreshTokenCompat string `json:"refreshToken"`
	Scope              string `json:"scope"`
}

func decodeJSONBody(r *stdhttp.Request, dst any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	if len(body) == 0 {
		return fmt.Errorf("request body is required")
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return fmt.Errorf("invalid JSON body: %w", err)
	}
	return nil
}

func writeJSON(w stdhttp.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w stdhttp.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{
		"code":    status,
		"message": err.Error(),
	})
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func tokenDOToDTO(t *biz.AuthToken) *v1.TokenResponse {
	if t == nil {
		return &v1.TokenResponse{}
	}
	return &v1.TokenResponse{
		AccessToken:  t.AccessToken,
		RefreshToken: t.RefreshToken,
		IdToken:      t.IDToken,
		TokenType:    t.TokenType,
		ExpiresIn:    t.ExpiresIn,
		Scope:        t.Scope,
	}
}
