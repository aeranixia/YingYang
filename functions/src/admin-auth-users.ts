import type { Auth } from 'firebase-admin/auth'
import { IdentityError } from './admin-identity'

export async function provisionGoogleAdmin(auth: Pick<Auth,'getUserByEmail'|'createUser'>, email:string) {
 try {
  const user=await auth.getUserByEmail(email)
  if(user.disabled)throw new IdentityError('permission-denied')
  return user.uid
 } catch(error) {
  if((error as {code?:string}).code!=='auth/user-not-found')throw error
 }
 try { return (await auth.createUser({email,emailVerified:false})).uid }
 catch(error) {
  if((error as {code?:string}).code!=='auth/email-already-exists')throw error
  const user=await auth.getUserByEmail(email)
  if(user.disabled)throw new IdentityError('permission-denied')
  return user.uid
 }
}
