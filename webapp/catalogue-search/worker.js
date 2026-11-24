// Catalogue Search Gateway — Worker source deployed as bfe-catalogue-frontdoor.
const SOURCE="https://raw.githubusercontent.com/unclehowell/cedwyn-catalogue/main/webapp/catalogue-search/index.html";
const CATALOGUE="https://bucklerfamily.estate/catalogue/";
const ALLOWED_SUFFIX="-datro.bucklerfamily.estate";
function targetFor(incoming){const target=new URL(CATALOGUE);for(const k of ["q","kind","sort","id","src","tab"])for(const v of incoming.searchParams.getAll(k))target.searchParams.append(k,v);return target;}
function hasSearch(url){return ["q","kind","sort","id","src","tab"].some(k=>url.searchParams.has(k));}
function fallback(){return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalogue Search</title><p>Search the live records catalogue at <a href="https://bucklerfamily.estate/catalogue/">bucklerfamily.estate/catalogue</a>.</p>',{status:503,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});}
export default{async fetch(request){const url=new URL(request.url),host=url.hostname.toLowerCase();
if(host==="bucklerfamily.estate"||host==="www.bucklerfamily.estate"||host.endsWith(ALLOWED_SUFFIX))return fetch(request);
if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method not allowed",{status:405,headers:{allow:"GET, HEAD"}});
if(hasSearch(url))return Response.redirect(targetFor(url).toString(),302);
try{const page=await fetch(SOURCE,{cf:{cacheTtl:300,cacheEverything:true}});if(!page.ok)return fallback();const h=new Headers(page.headers);h.set("content-type","text/html; charset=utf-8");h.set("cache-control","public, max-age=60, s-maxage=300");h.set("x-catalogue-search-gateway","1.0.0");h.set("x-robots-tag","noindex, nofollow");return new Response(request.method==="HEAD"?null:page.body,{status:200,headers:h});}catch{return fallback();}}};