package biz

import (
	stderrors "errors"

	"github.com/actionlab-ai/aisphere-kit/authz"
	"github.com/actionlab-ai/aisphere-kit/permission"
	"github.com/actionlab-ai/aisphere-kit/principal"
	"github.com/go-kratos/kratos/v3/errors"
)

// normalizeAccessError maps provider-neutral kit errors to Kratos semantic
// errors so HTTP/gRPC transports return correct status codes for every business
// module using kit/access.Guard.
func normalizeAccessError(err error) error {
	if err == nil {
		return nil
	}
	if stderrors.Is(err, principal.ErrMissingPrincipal) {
		return errors.Unauthorized("UNAUTHORIZED", "missing principal")
	}
	if stderrors.Is(err, authz.ErrDenied) || stderrors.Is(err, permission.ErrPermissionDenied) {
		return errors.Forbidden("PERMISSION_DENIED", err.Error())
	}
	if stderrors.Is(err, authz.ErrNotConfigured) || stderrors.Is(err, authz.ErrEmptyAuthorization) {
		return errors.InternalServer("AUTHZ_CONFIG_ERROR", err.Error())
	}
	return err
}
