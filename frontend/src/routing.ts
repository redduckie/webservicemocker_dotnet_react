import {useLocation,useNavigate,useParams as params} from 'react-router-dom';
import {useMemo} from 'react';
export function useRouter(){const navigate=useNavigate();return useMemo(()=>({push:(path:string)=>navigate(path),replace:(path:string)=>navigate(path,{replace:true}),back:()=>navigate(-1),refresh:()=>window.location.reload(),prefetch:()=>{}}),[navigate]);}
export function usePathname(){return useLocation().pathname;}
export function useSearchParams(){const {search}=useLocation();return useMemo(()=>new URLSearchParams(search),[search]);}
export function useParams<T extends Record<string,string>>() {return params() as T;}
