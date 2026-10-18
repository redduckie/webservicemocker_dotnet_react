import {Link} from 'react-router-dom';
import type {AnchorHTMLAttributes} from 'react';
type Props=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>&{href:string;prefetch?:boolean;replace?:boolean};
export default function AppLink({href,prefetch:_prefetch,replace,...props}:Props){return <Link to={href} replace={replace} {...props}/>;}
