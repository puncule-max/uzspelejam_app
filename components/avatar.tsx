export function Avatar({src,name,className}:{src?:string|null;name?:string|null;className:string}) {
  const initial=name?.trim()?.slice(0,1).toUpperCase()||"?";
  return src
    ? <img className={className} src={src} alt="" loading="lazy"/>
    : <div className={className} aria-hidden="true">{initial}</div>;
}
