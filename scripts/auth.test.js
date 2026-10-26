import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthReturn,authPageLink,validateRegistration,authErrorMessage } from '../src/utils/auth.js';
import { createAuthOperations } from '../src/services/auth-operations.js';

test('return paths stay in the app and preserve booking parameters through registration', () => {
  const next='/pages/booking/?roomTypeId=test&checkIn=2030-01-01&checkOut=2030-01-04&guests=2';
  assert.equal(safeAuthReturn(next),next);
  assert.equal(new URL(authPageLink('register',next),'https://example.invalid').searchParams.get('next'),next);
  for (const value of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/pages/login/','/pages/register/','/unknown/','/hotels/\n']) assert.equal(safeAuthReturn(value),'/hotels/');
});
test('registration checks names, confirmation and password length without trimming passwords', () => {
  assert.deepEqual(validateRegistration({displayName:'Guest',password:'abcdefg',confirmPassword:'abcdefg'}),{});
  const errors=validateRegistration({displayName:' ',password:'short',confirmPassword:'different'});
  assert.deepEqual(Object.keys(errors),['displayName','password','confirmPassword']);
  assert.equal(authErrorMessage({code:'invalid_credentials',message:'private raw error'}),'Email or password is incorrect.');
  assert.ok(!authErrorMessage({message:'private raw error'}).includes('private'));
});
test('signup uses guest metadata only and does not authenticate before confirmation', async () => {
  let attributes; let verificationCalls=0;
  const api=createAuthOperations({auth:{
    signUp:async input=>{attributes=input; return {data:{session:null}};},
    getUser:async()=>{verificationCalls++; return {data:{user:{id:'guest'}}};},
  }});
  const result=await api.registerGuest({email:' guest@example.invalid ',password:'test-only-password',displayName:' Guest ',emailRedirectTo:'https://example.invalid/pages/login/',role:'admin'});
  assert.deepEqual(result,{authenticated:false}); assert.equal(verificationCalls,0);
  assert.deepEqual(attributes.options.data,{display_name:'Guest'});
  assert.equal(attributes.email,'guest@example.invalid');
  assert.equal(attributes.options.emailRedirectTo,'https://example.invalid/pages/login/');
});
test('login verifies server identity, immediate-session signup verifies, and logout is local', async () => {
  let verified=0; let scope;
  const api=createAuthOperations({auth:{
    signInWithPassword:async()=>({error:null}),
    signUp:async()=>({data:{session:{}}}),
    getUser:async()=>{verified++; return {data:{user:{id:'guest'}}};},
    signOut:async input=>{scope=input.scope; return {error:null};},
  }});
  assert.equal((await api.loginGuest('guest@example.invalid','test-only-password')).id,'guest');
  assert.equal((await api.registerGuest({email:'guest@example.invalid',password:'test-only-password',displayName:'Guest'})).authenticated,true);
  assert.equal(verified,2); await api.logoutGuest(); assert.equal(scope,'local');
});
test('Auth errors propagate and missing sessions remain anonymous', async () => {
  const error={code:'invalid_credentials'};
  const api=createAuthOperations({auth:{signInWithPassword:async()=>({error}),getUser:async()=>({error:{name:'AuthSessionMissingError'}})}});
  await assert.rejects(api.loginGuest('guest@example.invalid','wrong'),failure=>failure===error);
  assert.equal(await api.getVerifiedUser(),null);
});
