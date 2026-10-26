import { AuthorizationScopeService } from './authorization-scope.service';
import { AuthScope } from './auth-scope';

describe('AuthorizationScopeService', () => {
  const svc = new AuthorizationScopeService();

  const tenantWide: AuthScope = { tenantId: 't1' };
  const campusScoped: AuthScope = {
    tenantId: 't1',
    campusIds: ['c1'],
  };
  const parentScope: AuthScope = {
    tenantId: 't1',
    linkedStudentIds: ['s1'],
  };

  it('allows tenant match', () => {
    expect(svc.assertSameTenant(tenantWide, 't1')).toBe(true);
    expect(svc.assertSameTenant(tenantWide, 't2')).toBe(false);
  });

  it('campus constraint', () => {
    expect(svc.canAccessCampus(campusScoped, 'c1')).toBe(true);
    expect(svc.canAccessCampus(campusScoped, 'c2')).toBe(false);
    expect(svc.canAccessCampus(tenantWide, 'c2')).toBe(true);
  });

  it('linked student', () => {
    expect(svc.canAccessLinkedStudent(parentScope, 's1')).toBe(true);
    expect(svc.canAccessLinkedStudent(parentScope, 's2')).toBe(false);
  });
});
