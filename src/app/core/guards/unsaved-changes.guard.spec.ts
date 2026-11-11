import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { vi } from 'vitest';
import {
  HasUnsavedChanges,
  UNSAVED_CHANGES_MESSAGE,
  unsavedChangesGuard,
} from './unsaved-changes.guard';

describe('unsavedChangesGuard (C1)', () => {
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = {} as RouterStateSnapshot;

  it('permite salir sin preguntar cuando no hay cambios pendientes', () => {
    const component: HasUnsavedChanges = {
      hasUnsavedChanges: () => false,
    };

    const result = unsavedChangesGuard(component, dummyRoute, dummyState, dummyState);
    expect(result).toBe(true);
  });

  it('usa confirmDiscardChanges del componente cuando hay cambios sin guardar', async () => {
    const confirmDiscardChanges = vi.fn().mockResolvedValue(false);
    const component: HasUnsavedChanges = {
      hasUnsavedChanges: () => true,
      confirmDiscardChanges,
    };

    const result = await unsavedChangesGuard(component, dummyRoute, dummyState, dummyState);
    expect(confirmDiscardChanges).toHaveBeenCalledOnce();
    expect(result).toBe(false);
  });

  it('recurre a window.confirm si el componente no define confirmDiscardChanges', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const component: HasUnsavedChanges = {
      hasUnsavedChanges: () => true,
    };

    const result = unsavedChangesGuard(component, dummyRoute, dummyState, dummyState);
    expect(confirmSpy).toHaveBeenCalledWith(UNSAVED_CHANGES_MESSAGE);
    expect(result).toBe(true);
    confirmSpy.mockRestore();
  });
});
