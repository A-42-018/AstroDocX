// Live orbital-sunrise backdrop, drawn procedurally in two passes (no image files):
//  1. SURFACE: oceans, land and clouds sliding beneath the camera. This is the expensive, soft part, so it is
//     drawn into an offscreen texture at reduced resolution.
//  2. COMPOSITE: everything that must be sharp, at full screen resolution (up to 4K): the anti-aliased limb,
//     the atmosphere line and glow, round stars and the Milky Way, the sun with its lens flare, tone mapping and
//     dithering (no banding in the dark gradients).
// Both passes share the same scene geometry, measured in screen-height units so the aspect ratio stays correct.

export const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`

const COMMON = `precision highp float;
uniform vec2 u_res;uniform float u_time;uniform float u_mood;
const float R=2.6;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<6;i++){s+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float fbm3(vec3 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
// Camera: x centred, y up, gently rolling.
vec2 toQ(vec2 uv){float asp=u_res.x/u_res.y;vec2 p=vec2((uv.x-.5)*asp,uv.y);
 float t=-.09+.015*sin(u_time*.05);return vec2(cos(t)*p.x-sin(t)*p.y,sin(t)*p.x+cos(t)*p.y);}
vec2 centre(){return vec2(0.,.43-R);}
// Sun elevation: rises over the limb, climbs a little, sets again (150 s loop).
float sunK(){return -.02+.26*(.5+.5*sin(u_time*6.2831/150.-1.2));}
vec2 sunDir(){float sx=.30*u_res.x/u_res.y;return normalize(vec2(sx,sqrt(R*R-sx*sx)));}
vec3 sunColour(){return mix(vec3(.72,.82,1.),vec3(1.,.66,.36),u_mood);}
vec3 atmosphere(vec2 dn){float k=sunK();float ang=acos(clamp(dot(dn,sunDir()),-1.,1.));float prox=exp(-ang*ang*7.);
 return mix(vec3(.22,.5,1.),mix(vec3(1.,.42,.16),vec3(.75,.55,.9),1.-u_mood),prox*smoothstep(-.2,.15,k));}
float proximity(vec2 dn){float ang=acos(clamp(dot(dn,sunDir()),-1.,1.));return exp(-ang*ang*7.);}
`

export const SURFACE = `${COMMON}
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;vec2 q=toQ(uv);vec2 d=q-centre();float r=length(d);
 // Past the limb, keep extending the edge colour so the composite's sharp edge never picks up black.
 if(r>R*.999){d*=R*.999/r;r=R*.999;}
 vec2 dn=d/r;float k=sunK();vec2 sd=sunDir();vec3 L=normalize(vec3(sd*cos(k),sin(k)));vec3 sunCol=sunColour();
 vec3 n=vec3(d,sqrt(max(R*R-r*r,0.)))/R;
 vec3 sp=rotX(u_time*.010)*n;
 vec3 w=sp*3.2+.7*vec3(fbm3(sp*2.1),fbm3(sp*2.1+4.3),fbm3(sp*2.1+8.7));
 float land=fbm(w);float isLand=smoothstep(.55,.575,land);
 vec3 ocean=mix(vec3(.01,.07,.2),vec3(.02,.24,.42),fbm3(sp*9.));
 ocean=mix(ocean,vec3(.04,.3,.4),smoothstep(.5,.55,land)*(1.-isLand)*.7);
 float relief=fbm(sp*14.+5.);
 vec3 ground=mix(vec3(.04,.24,.08),vec3(.38,.31,.17),smoothstep(.35,.7,fbm3(sp*7.+5.)));
 ground*=.8+.4*relief;
 vec3 surf=mix(ocean,ground,isLand);
 vec3 cp=rotX(u_time*.013)*n*5.5;
 float cl=fbm(cp+1.2*vec3(fbm3(cp*.6),fbm3(cp*.6+3.1),u_time*.01));
 float clouds=smoothstep(.5,.8,cl);
 float diff=dot(n,L);float lit=smoothstep(-.12,.38,diff);
 vec3 col=surf*lit*sunCol*1.45;
 col=mix(col,mix(sunCol,vec3(1.),.6)*lit*1.05*(.85+.3*smoothstep(.55,.9,cl)),clouds*.92);
 col+=vec3(1.,.38,.12)*smoothstep(.18,0.,abs(diff-.02))*.22*u_mood*(1.-clouds*.4);
 col+=surf*vec3(.05,.07,.11);
 float rim=pow(1.-n.z,3.);
 col=mix(col,atmosphere(dn)*(.35+lit),rim*.65);
 gl_FragColor=vec4(col*.5,1.);
}`

export const COMPOSITE = `${COMMON}
uniform sampler2D u_surf;uniform float u_dpr;
// One layer of stars: at most one per grid cell, round, sized in CSS pixels, steady with a faint shimmer.
vec3 stars(vec2 q,float scale,float density,float seed,float px){
 vec2 g=q*scale;vec2 id=floor(g);vec2 f=fract(g);
 float h=hash(vec3(id,seed));
 if(h>density)return vec3(0.);
 vec2 pos=.2+.6*vec2(hash(vec3(id,seed+1.)),hash(vec3(id,seed+2.)));
 float dpx=length(f-pos)/scale/px;
 float b=pow(hash(vec3(id,seed+3.)),5.);
 float size=mix(.55,1.6,b)*u_dpr;
 float shine=1.+.07*sin(u_time*(.4+h*1.3)+h*90.)*step(.5,b);
 vec3 tint=mix(vec3(.72,.82,1.),vec3(1.,.88,.72),hash(vec3(id,seed+4.)));
 return tint*exp(-dpx*dpx/(size*size))*(.18+1.9*b)*shine;
}
vec3 ghost(vec2 q,vec2 sp,vec2 axis,float t,float size,vec3 tint){
 float g=length(q-(sp+axis*t))/size;
 return tint*(smoothstep(1.,.55,g)*.045+exp(-pow((g-1.)*7.,2.))*.05);
}
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;vec2 q=toQ(uv);vec2 c=centre();vec2 d=q-c;float r=length(d);vec2 dn=d/r;
 float px=1./u_res.y;float k=sunK();vec2 sd=sunDir();vec3 sunCol=sunColour();float bright=mix(.72,1.,u_mood);
 vec3 atm=atmosphere(dn);float prox=proximity(dn);
 float glowLit=.25+.75*prox*smoothstep(-.25,.1,k);
 // Anti-aliased limb: about 1.2 device pixels wide.
 float mask=smoothstep(R+px*1.2,R-px*1.2,r);
 vec3 col=vec3(0.);
 if(mask<1.){
  float h=max(r-R,0.);
  float fade=smoothstep(.015,.22,h);
  vec3 sky=stars(q,95.,.24,1.,px)+stars(q,38.,.2,9.,px)+stars(q,14.,.16,17.,px);
  float band=exp(-pow(dot(q-vec2(-.2,.95),normalize(vec2(1.,-.38))),2.)*14.);
  sky+=band*fbm3(vec3(q*4.,3.))*vec3(.32,.36,.5)*.16;
  col=sky*fade;
  col+=atm*(exp(-h*40.)*1.5+exp(-h*7.)*.4)*glowLit;
 }
 col=mix(col,texture2D(u_surf,uv).rgb*2.,mask);
 // Bright, crisp line of atmosphere right on the limb.
 col+=atm*exp(-abs(r-R)/(px*1.5+.0025))*.55*glowLit;
 // Sun and lens flare.
 vec2 sp=c+sd*(R+.012+.10*k);vec2 v=q-sp;float ds=length(v);
 float vis=smoothstep(-.05,.06,k);
 float flick=1.+.045*sin(u_time*1.7)+.03*sin(u_time*4.3+1.);
 col+=sunCol*smoothstep(.013+px,.013-px,ds)*2.2*(1.-mask);
 col+=sunCol*((.003/(ds*ds+.003))*.5+exp(-ds*5.)*.22)*flick*(.45+.55*vis);
 float a=atan(v.y,v.x);
 float rays=pow(.5+.5*cos(a*6.+.4),18.)+.7*pow(.5+.5*cos(a*10.+1.9),26.)+.35*noise(vec3(a*9.,u_time*.08,1.));
 col+=sunCol*rays*exp(-ds*7.)*.3*vis*flick;
 col+=sunCol*exp(-abs(v.y)*95.)*exp(-abs(v.x)*1.5)*.38*vis;
 vec2 axis=toQ(vec2(.5))-sp;
 col+=(ghost(q,sp,axis,.38,.022,vec3(1.,.7,.4))+ghost(q,sp,axis,.62,.055,vec3(.5,.8,1.))
  +ghost(q,sp,axis,.95,.016,vec3(1.,.55,.3))+ghost(q,sp,axis,1.3,.09,vec3(.6,1.,.7))
  +ghost(q,sp,axis,1.7,.035,vec3(.8,.6,1.)))*vis*flick;
 col*=bright;
 col=1.-exp(-col*1.5);
 float asp=u_res.x/u_res.y;
 col*=mix(.55,1.,smoothstep(1.25,.35,length((uv-.5)*vec2(asp*.8,1.))));
 col=col*.95+(hash(vec3(gl_FragCoord.xy,fract(u_time)*7.))-.5)/255.;
 gl_FragColor=vec4(col,1.);
}`
