import {api} from '@/lib/api';
export async function signOutUser(){await api('/api/auth/logout','POST');window.location.assign('/login');}
