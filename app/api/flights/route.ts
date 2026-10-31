export const dynamic='force-dynamic';
type Flight={id:string;call:string;country:string;lat:number;lon:number;alt:number|null;speed:number|null;heading:number;ground:boolean;reg?:string;type?:string;seen:number};
type Data={flights:Flight[];time:number;source:string};
const cache=new Map<string,{expires:number;data:Data}>();
const pending=new Map<string,Promise<Data>>();
let cooldown=0;
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
export async function GET(request:Request){
 const u=new URL(request.url),regional=u.searchParams.has('lat')||u.searchParams.has('lon'),lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
 if(regional&&(!u.searchParams.has('lat')||!u.searchParams.has('lon')||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180))return Response.json({error:'Coordenadas no válidas.'},{status:400});
 const key=regional?`${lat.toFixed(2)},${lon.toFixed(2)}`:'global',ttl=regional?15:900,existing=cache.get(key);
 if(existing&&existing.expires>Date.now())return Response.json(existing.data,{headers:{'Cache-Control':`public, max-age=${Math.max(0,Math.floor((existing.expires-Date.now())/1000))}`}});
 if(!regional&&Date.now()<cooldown)return Response.json({error:'OpenSky alcanzó su límite de consultas. Prueba la vista Zona o vuelve más tarde.'},{status:429});
 try{if(!pending.has(key))pending.set(key,(async()=>{
  const url=regional?`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`:'https://opensky-network.org/api/states/all';
  const r=await fetch(url,{signal:AbortSignal.timeout(18000),headers:{Accept:'application/json'}});
  if(r.status===429){if(!regional)cooldown=Date.now()+Math.max(60,Number(r.headers.get('X-Rate-Limit-Retry-After-Seconds')||r.headers.get('Retry-After'))||900)*1000;throw new Error('La fuente alcanzó su límite de consultas. Prueba la otra vista o vuelve más tarde.')}
  if(!r.ok)throw new Error('La fuente de vuelos no está disponible temporalmente. Prueba la otra vista.');
  const body=await r.json() as any;
  if(regional&&!Array.isArray(body.ac)||!regional&&body.states!==null&&!Array.isArray(body.states))throw new Error('La fuente devolvió datos no válidos.');
  const time=regional?Math.floor(body.now/1000):body.time;
  if(!Number.isFinite(time))throw new Error('La fuente devolvió una hora no válida.');
  const flights:Flight[]=regional?body.ac.filter((f:any)=>num(f.lat)!==null&&num(f.lon)!==null).map((f:any)=>({id:f.hex,call:(f.flight||f.r||f.hex).trim(),country:'',lat:f.lat,lon:f.lon,alt:num(f.alt_baro),speed:num(f.gs),heading:num(f.track)??0,ground:f.alt_baro==='ground',reg:f.r,type:f.t,seen:time-(num(f.seen_pos)??0)})):(body.states||[]).filter((s:any)=>num(s[5])!==null&&num(s[6])!==null).map((s:any)=>({id:s[0],call:s[1]?.trim()||s[0].toUpperCase(),country:s[2],lon:s[5],lat:s[6],alt:num(s[7])===null?null:s[7]*3.28084,speed:num(s[9])===null?null:s[9]*1.94384,heading:num(s[10])??0,ground:s[8],seen:s[3]||s[4]||time}));
  const data={flights,time,source:regional?'ADSB.lol':'OpenSky Network'};
  if(cache.size>80){for(const [k,v] of cache)if(v.expires<Date.now())cache.delete(k);if(cache.size>80)cache.delete(cache.keys().next().value!)}
  cache.set(key,{data,expires:Date.now()+ttl*1000});return data;
 })());const data=await pending.get(key)!;return Response.json(data,{headers:{'Cache-Control':`public, max-age=${ttl}`}})
 }catch(e){return Response.json({error:e instanceof Error?e.message:'No se pudo conectar con la fuente de vuelos.'},{status:503})}finally{pending.delete(key)}
}
