// Package data auth module — Casdoor OAuth adapter through aisphere-kit runtime.

package data

import (
	"context"
	"fmt"

	"aisphere-hub/internal/biz"

	"github.com/actionlab-ai/aisphere-kit/authn"
)

type authRepo struct {
	data *Data
}

func NewAuthRepo(data *Data) biz.AuthRepo {
	return &authRepo{data: data}
}

func (r *authRepo) Authenticate(ctx context.Context, token string) (context.Context, error) {
	if r == nil || r.data == nil || r.data.Runtime == nil || r.data.Runtime.Authn == nil {
		return ctx, fmt.Errorf("authn provider is not configured")
	}
	ctx2, _, err := authn.AuthenticateToken(ctx, r.data.Runtime.Authn, token, false)
	if err != nil {
		return ctx, err
	}
	return ctx2, nil
}

func (r *authRepo) LoginURL(ctx context.Context, req biz.AuthLoginURLRequest) (string, error) {
	builder, err := r.loginURLBuilder()
	if err != nil {
		return "", err
	}
	return builder.LoginURL(authn.LoginRequest{
		RedirectURI: req.RedirectURI,
		State:       req.State,
		Scope:       req.Scope,
		Prompt:      req.Prompt,
	})
}

func (r *authRepo) LogoutURL(ctx context.Context, req biz.AuthLogoutURLRequest) (string, error) {
	builder, err := r.logoutURLBuilder()
	if err != nil {
		return "", err
	}
	return builder.LogoutURL(authn.LogoutRequest{
		PostLogoutRedirectURI: req.PostLogoutRedirectURI,
		IDTokenHint:           req.IDTokenHint,
		State:                 req.State,
	})
}

func (r *authRepo) Exchange(ctx context.Context, req biz.AuthExchangeRequest) (*biz.AuthToken, error) {
	exchanger, err := r.oauthExchanger()
	if err != nil {
		return nil, err
	}
	out, err := exchanger.ExchangeCode(ctx, authn.ExchangeCodeRequest{
		Code:        req.Code,
		RedirectURI: req.RedirectURI,
	})
	if err != nil {
		return nil, err
	}
	return authTokenFromKit(out), nil
}

func (r *authRepo) Refresh(ctx context.Context, req biz.AuthRefreshRequest) (*biz.AuthToken, error) {
	exchanger, err := r.oauthExchanger()
	if err != nil {
		return nil, err
	}
	out, err := exchanger.RefreshToken(ctx, authn.RefreshTokenRequest{
		RefreshToken: req.RefreshToken,
		Scope:        req.Scope,
	})
	if err != nil {
		return nil, err
	}
	return authTokenFromKit(out), nil
}

func (r *authRepo) loginURLBuilder() (authn.LoginURLBuilder, error) {
	if r == nil || r.data == nil || r.data.Runtime == nil || r.data.Runtime.Casdoor == nil {
		return nil, fmt.Errorf("casdoor login provider is not configured")
	}
	return r.data.Runtime.Casdoor, nil
}

func (r *authRepo) logoutURLBuilder() (authn.LogoutURLBuilder, error) {
	if r == nil || r.data == nil || r.data.Runtime == nil || r.data.Runtime.Casdoor == nil {
		return nil, fmt.Errorf("casdoor logout provider is not configured")
	}
	return r.data.Runtime.Casdoor, nil
}

func (r *authRepo) oauthExchanger() (authn.OAuthExchanger, error) {
	if r == nil || r.data == nil || r.data.Runtime == nil || r.data.Runtime.Casdoor == nil {
		return nil, fmt.Errorf("casdoor oauth provider is not configured")
	}
	return r.data.Runtime.Casdoor, nil
}

func authTokenFromKit(t *authn.TokenResponse) *biz.AuthToken {
	if t == nil {
		return &biz.AuthToken{}
	}
	return &biz.AuthToken{
		AccessToken:  t.AccessToken,
		RefreshToken: t.RefreshToken,
		IDToken:      t.IDToken,
		TokenType:    t.TokenType,
		ExpiresIn:    t.ExpiresIn,
		Scope:        t.Scope,
	}
}
