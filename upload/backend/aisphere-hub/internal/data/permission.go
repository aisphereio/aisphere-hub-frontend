package data

import "github.com/actionlab-ai/aisphere-kit/permission"

// NewPermissionManager exposes the kit permission facade to business usecases.
// Hub modules must use this manager instead of calling Casdoor SDKs directly.
func NewPermissionManager(data *Data) permission.Manager {
	if data == nil || data.Runtime == nil {
		return nil
	}
	return data.Runtime.Permission
}
