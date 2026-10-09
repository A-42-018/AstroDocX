// The other console backdrops, each one full-screen pass (no image files). Loaded only when a crew member picks one,
// so the default sunrise (backdropShaders.ts) stays the only shader in the main bundle.
// Every scene takes the same uniforms as the sunrise: u_mood 1 = nominal (warm, bright), 0 = Act (cooler, dimmer),
// and keeps its subject low and to the right, where the scrim is lightest and no text sits.

const HEAD = `precision highp float;
uniform vec2 u_res;uniform float u_time;uniform float u_mood;uniform float u_dpr;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
// Round stars sized in CSS pixels, at most one per grid cell (same look as the sunrise sky).
vec3 stars(vec2 q,float scale,float density,float seed,float px){
 vec2 g=q*scale;vec2 id=floor(g);vec2 f=fract(g);float h=hash(id+seed);
 if(h>density)return vec3(0.);
 vec2 pos=.2+.6*vec2(hash(id+seed+1.3),hash(id+seed+2.7));
 float dpx=length(f-pos)/scale/px;float b=pow(hash(id+seed+3.1),5.);float size=mix(.55,1.6,b)*u_dpr;
 float shine=1.+.08*sin(u_time*(.4+h*1.3)+h*90.)*step(.5,b);
 vec3 tint=mix(vec3(.72,.82,1.),vec3(1.,.88,.72),hash(id+seed+4.9));
 return tint*exp(-dpx*dpx/(size*size))*(.18+1.9*b)*shine;}
vec3 sky(vec2 q,float px){return stars(q,95.,.24,1.,px)+stars(q,38.,.2,9.,px)+stars(q,14.,.16,17.,px);}
// Screen-height units, x centred, y up from the bottom edge.
vec2 toQ(vec2 uv){return vec2((uv.x-.5)*u_res.x/u_res.y,uv.y);}
// Tone map, vignette and dither (no banding in the dark gradients).
vec3 finish(vec3 col,vec2 uv){
 col*=mix(.72,1.,u_mood);col=1.-exp(-col*1.5);
 col*=mix(.55,1.,smoothstep(1.25,.35,length((uv-.5)*vec2(u_res.x/u_res.y*.8,1.))));
 return col*.95+(hash(gl_FragCoord.xy+fract(u_time)*61.)-.5)/255.;}
`

/** Night pass: the dark side of Earth with city lights, and an aurora along the limb (green, amber with an Act). */
const NIGHT = `${HEAD}
const float R=2.6;
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;vec2 p=toQ(uv);
 float tl=-.07+.012*sin(u_time*.05);vec2 q=vec2(cos(tl)*p.x-sin(tl)*p.y,sin(tl)*p.x+cos(tl)*p.y);
 vec2 c=vec2(0.,.36-R);vec2 d=q-c;float r=length(d);float px=1./u_res.y;
 float mask=smoothstep(R+px*1.2,R-px*1.2,r);
 vec3 glow=mix(vec3(1.,.55,.18),vec3(.25,1.,.55),u_mood);vec3 crown=mix(vec3(1.,.3,.35),vec3(.55,.3,1.),u_mood);
 // Sky with the aurora curtains standing on the limb.
 float h=max(r-R,0.);
 vec3 col=sky(q,px)*smoothstep(.01,.2,h)*.9;
 float x=atan(d.x,d.y)*R*2.2;
 float w=fbm(vec2(x*1.3,u_time*.05));
 float curtain=pow(.5+.5*sin(x*2.6+w*6.+u_time*.12),1.5)*(.35+.65*smoothstep(.3,.7,noise(vec2(x*.7,u_time*.03))));
 float rays=.55+.45*noise(vec2(x*30.+w*8.,u_time*.35));
 float hh=h-(.012+.02*noise(vec2(x*2.,u_time*.1)));
 float body=smoothstep(0.,.012,hh)*exp(-max(hh,0.)*6.);
 col+=mix(glow,crown,smoothstep(.05,.3,hh))*body*curtain*rays*1.4;
 col+=glow*exp(-h*22.)*.18;
 // Night side: dark oceans and land, clusters of warm city light, faint clouds drifting over them.
 if(mask>0.){
  vec3 n=vec3(d,sqrt(max(R*R-r*r,0.)))/R;vec3 sp=rotX(u_time*.008)*n;
  vec3 wq=sp*3.2+.7*vec3(fbm3(sp*2.1),fbm3(sp*2.1+4.3),fbm3(sp*2.1+8.7));
  // The night side shows a small cap of the globe, so land starts lower than on the sunrise: about a quarter is land.
  float isLand=smoothstep(.44,.465,fbm3(wq));
  // Cities: fine points of light inside clusters, plus a faint glow over each cluster.
  float cluster=smoothstep(.3,.55,fbm3(sp*18.+2.))*isLand;
  float lights=(smoothstep(.68,.9,noise3(sp*700.))+.12)*cluster;
  float cl=smoothstep(.55,.8,fbm3(rotX(u_time*.011)*n*5.5));
  vec3 surf=mix(vec3(.004,.012,.03),vec3(.012,.018,.02),isLand);
  surf+=vec3(1.,.68,.32)*lights*(1.-cl*.8)*1.6*sqrt(n.z);
  surf+=vec3(.05,.06,.09)*cl*.35;
  surf=mix(surf,glow*.35,pow(1.-n.z,6.)*.5);
  col=mix(col,surf,mask);
 }
 col+=glow*exp(-abs(r-R)/(px*1.5+.002))*.35;
 gl_FragColor=vec4(finish(col,uv),1.);
}`

/** Earthrise: grey lunar ground in front, Earth hanging over the horizon and slowly drifting. */
const EARTHRISE = `${HEAD}
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;vec2 q=toQ(uv);float px=1./u_res.y;float asp=u_res.x/u_res.y;
 float hz=.30+.035*fbm(vec2(q.x*1.5,3.))-.06*q.x*q.x;
 vec3 col=sky(q,px)*.7;
 // Earth: lit from the upper left, oceans, land and clouds turning slowly, thin blue atmosphere.
 vec2 e=vec2(.5*asp-.2,.7+.02*sin(u_time*.035));float er=.09;
 vec2 v=(q-e)/er;float vv=length(v);
 vec3 L=normalize(vec3(-.75,.35,.55));
 if(vv<1.){
  vec3 n=vec3(v,sqrt(1.-vv*vv));vec3 sp=rotY(u_time*.02)*n;
  float lit=smoothstep(-.08,.5,dot(n,L));
  vec3 wq=sp*2.2+.6*vec3(fbm3(sp*1.7),fbm3(sp*1.7+4.3),fbm3(sp*1.7+8.7));
  float land=smoothstep(.58,.62,fbm3(wq));
  vec3 surf=mix(mix(vec3(.01,.08,.24),vec3(.03,.22,.42),fbm3(sp*7.)),mix(vec3(.06,.16,.07),vec3(.3,.25,.16),smoothstep(.35,.7,fbm3(sp*5.+5.))),land);
  float cl=smoothstep(.5,.78,fbm3(rotY(u_time*.026)*n*3.4+1.2));
  vec3 ec=mix(surf,vec3(1.),cl*.9)*lit*1.5;
  ec=mix(ec,vec3(.3,.6,1.)*(.2+lit),pow(1.-n.z,3.)*.6);
  col=mix(col,ec,smoothstep(1.,1.-px/er*1.5,vv));
 }
 col+=vec3(.3,.6,1.)*exp(-max(vv-1.,0.)*er/.006)*.5*smoothstep(-.3,.6,dot(normalize(vec3(v,.2)),L))*step(1.,vv);
 // Lunar ground, with perspective: texture squeezes toward the horizon, low sun from the left.
 if(q.y<hz+px*2.){
  float z=1./(hz-q.y+.06);vec2 t=vec2(q.x*z,z)*1.4;
  float tex=fbm(t*vec2(1.6,1.))*.6+fbm(t*vec2(6.,3.))*.25;
  float cr=noise(t*vec2(.9,.6)+3.);float rim=smoothstep(.7,.74,cr)-smoothstep(.74,.82,cr)*1.4;
  float shade=mix(.18,1.,smoothstep(-.02,hz,q.y))*(.8+.25*smoothstep(.2,-.6,q.x/asp));
  vec3 g=vec3(.5,.49,.47)*(.35+tex+rim*.18)*shade*mix(vec3(.9,.95,1.08),vec3(1.05,1.,.94),u_mood);
  col=mix(col,g*.8,smoothstep(hz+px,hz-px,q.y));
 }
 gl_FragColor=vec4(finish(col,uv),1.);
}`

/** Deep field: slowly drifting nebula gas, dust lanes and stars. Teal and violet; warms toward red with an Act. */
const DEEPFIELD = `${HEAD}
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;vec2 q=toQ(uv);float px=1./u_res.y;float asp=u_res.x/u_res.y;
 vec2 g=q*1.4+vec2(u_time*.006,u_time*.002);
 vec2 w=vec2(fbm(g*1.2+u_time*.008),fbm(g*1.2+4.+u_time*.01));
 float n1=fbm(g*1.6+w*1.6);float n2=fbm(g*3.+w*2.+7.);
 vec3 gas=mix(vec3(.95,.42,.22),vec3(.1,.5,.66),u_mood);vec3 violet=vec3(.45,.2,.72);
 vec2 core=vec2(.32*asp,.42);float cg=exp(-length(q-core)*1.8);
 vec3 col=gas*smoothstep(.34,.85,n1)*(.45+1.4*cg);
 col+=violet*pow(n2,2.5)*2.4*mix(.6,1.,u_mood)*(.5+cg);
 col*=.35+.65*smoothstep(.25,.62,fbm(g*4.+w*3.+11.));
 col+=gas*cg*.08;
 col+=sky(q,px)*(.8-.4*smoothstep(.5,.9,n1));
 gl_FragColor=vec4(finish(col,uv),1.);
}`

export const SCENES = { night: NIGHT, earthrise: EARTHRISE, deepfield: DEEPFIELD } as const
