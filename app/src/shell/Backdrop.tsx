import { liveQuery } from 'dexie'
import { useEffect, useRef, useState } from 'react'
import { db, openAlerts } from '../data/db'
import type { Status } from '../data/types'
import { useBoard } from '../board/store'

/** The selected crew member's worst open alert (one indexed read), used to set the mood of the sky. */
function useCrewStatus(): Status {
  const crewId = useBoard((s) => s.crewId)
  const ready = useBoard((s) => s.boot.state === 'ready')
  const [status, setStatus] = useState<Status>('nominal')
  useEffect(() => {
    if (!ready) return
    const sub = liveQuery(async () => {
      const id = crewId ?? (await db.crew.toCollection().first())?.id
      const alerts = id ? await openAlerts(id) : []
      return alerts.some((a) => a.status === 'act') ? 'act' : alerts.length ? 'watch' : 'nominal'
    }).subscribe({ next: (s) => setStatus(s as Status), error: () => undefined })
    return () => sub.unsubscribe()
  }, [crewId, ready])
  return status
}

/** Warm golden sunrise when nominal, paler when there is a Watch, cool and dimmer with an Act. */
const MOOD: Record<Status, number> = { nominal: 1, watch: 0.55, act: 0 }

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`

// Orbital sunrise, drawn procedurally (no textures): Earth's limb seen from low orbit, ground and clouds sliding
// beneath the camera, a thin atmosphere glowing blue and orange near the sun, and the sun rising and setting on a
// slow loop. Everything is soft and dark enough to sit behind glass panels.
const FRAG = `precision highp float;
uniform vec2 u_res;uniform float u_time;uniform float u_mood;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
void main(){
 vec2 uv=gl_FragCoord.xy/u_res;float asp=u_res.x/u_res.y;
 vec2 p=vec2((uv.x-.5)*asp,uv.y);
 float tilt=-.09+.015*sin(u_time*.05);
 vec2 q=vec2(cos(tilt)*p.x-sin(tilt)*p.y,sin(tilt)*p.x+cos(tilt)*p.y);
 float R=2.6;vec2 c=vec2(0.,.43-R);
 vec2 d=q-c;float r=length(d);vec2 dn=d/r;
 // Sun: rises over the limb, climbs a little, sets again (150 s loop).
 float k=-.02+.26*(.5+.5*sin(u_time*6.2831/150.-1.2));
 float sx=.30*asp;vec2 sd=normalize(vec2(sx,sqrt(R*R-sx*sx)));
 vec2 sunPos=c+sd*(R+.012+.10*k);
 vec3 L=normalize(vec3(sd*cos(k),sin(k)));
 vec3 warm=vec3(1.,.66,.36),cool=vec3(.72,.82,1.);
 vec3 sunCol=mix(cool,warm,u_mood);float bright=mix(.72,1.,u_mood);
 float ang=acos(clamp(dot(dn,sd),-1.,1.));float prox=exp(-ang*ang*7.);
 vec3 atm=mix(vec3(.22,.5,1.),mix(vec3(1.,.42,.16),vec3(.75,.55,.9),1.-u_mood),prox*smoothstep(-.2,.15,k));
 vec3 col;
 if(r<R){
  vec3 n=vec3(d,sqrt(max(R*R-r*r,0.)))/R;
  vec3 sp=rotX(u_time*.010)*n;
  vec3 w=sp*3.2+.7*vec3(fbm(sp*2.1),fbm(sp*2.1+4.3),fbm(sp*2.1+8.7));
  float land=fbm(w);float isLand=smoothstep(.55,.58,land);
  vec3 ocean=mix(vec3(.01,.07,.2),vec3(.02,.24,.42),fbm(sp*9.));
  ocean=mix(ocean,vec3(.04,.3,.4),smoothstep(.5,.55,land)*(1.-isLand)*.7);
  vec3 ground=mix(vec3(.04,.24,.08),vec3(.38,.31,.17),smoothstep(.35,.7,fbm(sp*7.+5.)));
  vec3 surf=mix(ocean,ground,isLand);
  vec3 cp=rotX(u_time*.013)*n*5.5;
  float cl=fbm(cp+1.2*vec3(fbm(cp*.6),fbm(cp*.6+3.1),u_time*.01));
  float clouds=smoothstep(.5,.8,cl);
  float diff=dot(n,L);float lit=smoothstep(-.06,.4,diff);
  col=surf*lit*sunCol*1.3;
  col=mix(col,vec3(1.)*mix(sunCol,vec3(1.),.6)*lit*1.05,clouds*.9);
  col+=vec3(1.,.38,.12)*smoothstep(.18,0.,abs(diff-.02))*.22*u_mood*(1.-clouds*.4);
  col+=surf*vec3(.02,.03,.06);
  float rim=pow(1.-n.z,3.);
  col=mix(col,atm*(.35+lit),rim*.65);
 }else{
  float h=r-R;
  vec2 sg=floor(uv*u_res/2.);float st=hash(vec3(sg,7.));
  float star=step(.9965,st)*(.5+.5*sin(u_time*(1.+st*3.)+st*40.));
  col=vec3(star)*.8*smoothstep(.02,.25,h);
  float glowLit=.25+.75*prox*smoothstep(-.25,.1,k);
  col+=atm*(exp(-h*40.)*1.5+exp(-h*7.)*.4)*glowLit;
  float ds=length(q-sunPos);
  col+=sunCol*smoothstep(.016,.01,ds)*1.6;
 }
 float ds=length(q-sunPos);
 col+=sunCol*((.003/(ds*ds+.003))*.5+exp(-ds*5.)*.22);
 col+=sunCol*exp(-abs(q.y-sunPos.y)*60.)*exp(-abs(q.x-sunPos.x)*2.)*.35;
 col*=bright;
 col=1.-exp(-col*1.5);
 float v=smoothstep(1.25,.35,length((uv-.5)*vec2(asp*.8,1.)));
 col*=mix(.55,1.,v);
 gl_FragColor=vec4(col*.95,1.);
}`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

/** Render scale: the scene is soft, so half resolution looks the same and costs a quarter of the GPU time. */
const SCALE = 0.5
const FPS = 30

/**
 * Live orbital-sunrise backdrop (WebGL, no images). Runs at 30 fps and half resolution, pauses when the tab is
 * hidden, and draws one still frame for people who prefer reduced motion. Without WebGL the CSS gradient
 * behind the canvas is the fallback. Decorative only, so it is hidden from assistive tech.
 */
export function Backdrop() {
  const status = useCrewStatus()
  const canvas = useRef<HTMLCanvasElement>(null)
  const mood = useRef(MOOD[status])
  const target = useRef(MOOD[status])
  const [failed, setFailed] = useState(false)
  useEffect(() => { target.current = MOOD[status] }, [status])

  useEffect(() => {
    const el = canvas.current
    // jsdom (tests) has no WebGL; skip quietly.
    if (!el || /jsdom/i.test(navigator.userAgent)) return
    const gl = el.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) { setFailed(true); return }
    let prog: WebGLProgram
    try {
      prog = gl.createProgram()!
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link')
    } catch {
      setFailed(true)
      return
    }
    gl.useProgram(prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uMood = gl.getUniformLocation(prog, 'u_mood')

    // Start mid-sunrise so the first frame already looks good.
    const START = 40
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const resize = () => {
      el.width = Math.max(1, Math.round(el.clientWidth * SCALE))
      el.height = Math.max(1, Math.round(el.clientHeight * SCALE))
      gl.viewport(0, 0, el.width, el.height)
    }
    let lastT = START
    const draw = (t: number) => {
      lastT = t
      mood.current += (target.current - mood.current) * 0.04
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uMood, mood.current)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    resize()
    // Resizing clears the canvas, so redraw straight away (the loop may be paused in a hidden tab).
    const ro = new ResizeObserver(() => { resize(); draw(lastT) })
    ro.observe(el)

    if (still) {
      mood.current = target.current
      draw(START)
      // Keep the mood in step with crew status without animating.
      const id = setInterval(() => { mood.current = target.current; draw(START) }, 2000)
      return () => { clearInterval(id); ro.disconnect() }
    }
    // Draw the first frame now, even if the tab starts hidden, so the sky is never black.
    draw(START)
    let raf = 0
    let last = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || now - last < 1000 / FPS) return
      last = now
      draw(START + (now - t0) / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <div className={`backdrop tint-${status}`} aria-hidden="true">
      {!failed && <canvas ref={canvas} className="bd-canvas" />}
      <div className="bd-scrim" />
    </div>
  )
}
