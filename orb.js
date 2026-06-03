/* ═══════════════════════════════════════════════════════════════
   AREX ORB MARK III — WebGL + GLSL Shaders
   Fresnel rim · Wave displacement · Plasma energy bands
   Falls back to 2D Canvas particle sphere when WebGL unavailable.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── State configs ──────────────────────────────────────── */
  const CFG = {
    default:   { r:0,    g:0.83, b:1,    speed:0.40, amp:0,    freq:0,   coreInt:0.30, rimPow:2.2, eSpeed:1.0 },
    speaking:  { r:0.78, g:0.94, b:1,    speed:2.20, amp:0.12, freq:4.5, coreInt:0.88, rimPow:1.5, eSpeed:3.0 },
    thinking:  { r:0,    g:0.63, b:1,    speed:1.20, amp:0.06, freq:2.0, coreInt:0.55, rimPow:2.0, eSpeed:1.8 },
    listening: { r:0,    g:1,    b:0.67, speed:0.50, amp:0.04, freq:1.5, coreInt:0.42, rimPow:2.0, eSpeed:1.2 },
    searching: { r:1,    g:0.55, b:0,    speed:1.80, amp:0.09, freq:3.5, coreInt:0.68, rimPow:1.8, eSpeed:2.2 },
  };

  /* ─── GLSL Vertex Shader ─────────────────────────────────── */
  const VERT = `
    attribute vec3 aPos;
    attribute vec3 aNorm;
    uniform   mat4 uMVP;
    uniform   mat4 uModel;
    uniform   mat3 uNorm;
    uniform float  uTime;
    uniform float  uAmp;
    uniform float  uFreq;
    varying vec3   vN;
    varying vec3   vWP;
    varying vec3   vMP;
    varying float  vD;
    void main(){
      float d = uAmp
        * sin(aPos.x * uFreq + uTime)
        * sin(aPos.y * uFreq * 0.9 + uTime * 1.1)
        * sin(aPos.z * uFreq * 1.2 + uTime * 0.7);
      vec3 p = aPos + aNorm * d;
      vN  = normalize(uNorm * aNorm);
      vWP = (uModel * vec4(p, 1.0)).xyz;
      vMP = p;
      vD  = d;
      gl_Position = uMVP * vec4(p, 1.0);
    }
  `;

  /* ─── GLSL Fragment Shader ───────────────────────────────── */
  const FRAG = `
    precision mediump float;
    uniform vec3  uColor;
    uniform float uTime;
    uniform float uCoreInt;
    uniform float uRimPow;
    uniform float uESpeed;
    uniform vec3  uCamPos;
    varying vec3  vN;
    varying vec3  vWP;
    varying vec3  vMP;
    varying float vD;
    void main(){
      vec3  V    = normalize(uCamPos - vWP);
      float ndv  = abs(dot(normalize(vN), V));

      /* Fresnel rim glow */
      float rim  = pow(1.0 - ndv, uRimPow);

      /* Latitude energy bands (co-rotate with sphere) */
      float lat  = vMP.y * 11.0 + uTime * uESpeed;
      float band = pow(max(0.0, sin(lat) * 0.5 + 0.5), 7.0) * 0.55;

      /* Longitude swirl */
      float lon   = atan(vMP.z, vMP.x) * 4.0 + uTime * uESpeed * 0.55;
      float swirl = pow(max(0.0, sin(lon) * 0.5 + 0.5), 14.0) * 0.28;

      /* Displacement brightness */
      float dg   = max(0.0, vD) * 3.5;

      /* Core face illumination */
      float core = pow(ndv, 0.5) * uCoreInt;

      float a = clamp(rim * 0.92 + band + swirl + dg + core * 0.32, 0.0, 0.95);
      vec3  c = uColor + band * 0.22 * vec3(0.8, 0.92, 1.0);
      gl_FragColor = vec4(c, a);
    }
  `;

  /* ─── Column-major 4×4 matrix math ──────────────────────── */
  const m4 = () => new Float32Array(16);

  function perspective(fov, asp, n, f) {
    const h = Math.tan(fov * 0.5), o = m4();
    o[0] = 1/(h*asp); o[5] = 1/h;
    o[10] = -(f+n)/(f-n); o[11] = -1;
    o[14] = -2*f*n/(f-n);
    return o;
  }
  function rotY(a) {
    const c = Math.cos(a), s = Math.sin(a), o = m4();
    o[0]=c; o[2]=-s; o[5]=1; o[8]=s; o[10]=c; o[15]=1;
    return o;
  }
  function rotX(a) {
    const c = Math.cos(a), s = Math.sin(a), o = m4();
    o[0]=1; o[5]=c; o[6]=s; o[9]=-s; o[10]=c; o[15]=1;
    return o;
  }
  function trans(z) {
    const o = m4(); o[0]=o[5]=o[10]=o[15]=1; o[14]=z;
    return o;
  }
  function mul(a, b) {
    const o = m4();
    for (let c=0;c<4;c++) for (let r=0;r<4;r++) for (let k=0;k<4;k++)
      o[c*4+r] += a[k*4+r] * b[c*4+k];
    return o;
  }
  function m3(m) {
    return new Float32Array([m[0],m[1],m[2], m[4],m[5],m[6], m[8],m[9],m[10]]);
  }

  /* ─── Sphere geometry (lat-lon grid) ─────────────────────── */
  function buildSphere(rings, segs) {
    const v=[], n=[], idx=[];
    for (let r=0;r<=rings;r++) {
      const t = Math.PI*r/rings, st = Math.sin(t), ct = Math.cos(t);
      for (let s=0;s<=segs;s++) {
        const p = 2*Math.PI*s/segs, x=st*Math.cos(p), y=ct, z=st*Math.sin(p);
        v.push(x,y,z); n.push(x,y,z);
      }
    }
    for (let r=0;r<rings;r++) for (let s=0;s<segs;s++) {
      const a=r*(segs+1)+s, b=a+segs+1;
      idx.push(a,b,a+1, b,b+1,a+1);
    }
    return { v:new Float32Array(v), n:new Float32Array(n), i:new Uint16Array(idx) };
  }

  /* ─── WebGL state ────────────────────────────────────────── */
  let gl, prog, locs, bufs, icnt;
  let aY=0, aX=0.35, uT=0;
  let cur = { ...CFG.default };
  let tgt = { ...CFG.default };
  const lerp = (a,b,k) => a+(b-a)*k;

  function compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }

  /* ─── WebGL initialisation ───────────────────────────────── */
  function tryWebGL(el) {
    /* Test WebGL availability without touching DOM */
    const test = document.createElement('canvas');
    const testGL = test.getContext('webgl', {alpha:true});
    if (!testGL) return false;

    el.querySelector('.orb-core')?.remove();

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;border-radius:50%;pointer-events:none;';
    el.style.overflow = 'hidden';
    el.appendChild(cv);

    gl = cv.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:false });
    if (!gl) { cv.remove(); return false; }

    const dpr = devicePixelRatio || 1;
    function resize() {
      const w=el.offsetWidth||90, h=el.offsetHeight||90;
      cv.width=w*dpr; cv.height=h*dpr;
      cv.style.width=w+'px'; cv.style.height=h+'px';
      gl.viewport(0,0,cv.width,cv.height);
    }
    resize();
    window.ResizeObserver && new ResizeObserver(resize).observe(el);

    const p = gl.createProgram();
    gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER,   VERT));
    gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('AREX Orb GL link failed:', gl.getProgramInfoLog(p));
      cv.remove(); return false;
    }
    gl.useProgram(p); prog = p;

    const geo = buildSphere(40, 40);
    icnt = geo.i.length;
    bufs = { v:gl.createBuffer(), n:gl.createBuffer(), i:gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.v);
    gl.bufferData(gl.ARRAY_BUFFER, geo.v, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.n);
    gl.bufferData(gl.ARRAY_BUFFER, geo.n, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.i);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.i, gl.STATIC_DRAW);

    locs = {
      aPos:gl.getAttribLocation(p,'aPos'), aNorm:gl.getAttribLocation(p,'aNorm'),
      uMVP:gl.getUniformLocation(p,'uMVP'), uModel:gl.getUniformLocation(p,'uModel'),
      uNorm:gl.getUniformLocation(p,'uNorm'), uTime:gl.getUniformLocation(p,'uTime'),
      uAmp:gl.getUniformLocation(p,'uAmp'),   uFreq:gl.getUniformLocation(p,'uFreq'),
      uColor:gl.getUniformLocation(p,'uColor'), uCoreInt:gl.getUniformLocation(p,'uCoreInt'),
      uRimPow:gl.getUniformLocation(p,'uRimPow'), uESpeed:gl.getUniformLocation(p,'uESpeed'),
      uCamPos:gl.getUniformLocation(p,'uCamPos'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);   // additive blending → holographic glow
    gl.disable(gl.DEPTH_TEST);

    new MutationObserver(() => {
      const cl = el.classList;
      tgt = { ...(
        cl.contains('speaking')  ? CFG.speaking  :
        cl.contains('thinking')  ? CFG.thinking  :
        cl.contains('listening') ? CFG.listening :
        cl.contains('searching') ? CFG.searching : CFG.default
      )};
    }).observe(el, { attributes:true, attributeFilter:['class'] });

    return true;
  }

  /* ─── WebGL render loop ──────────────────────────────────── */
  function renderWebGL() {
    if (!gl || document.hidden) return;
    uT += 0.016;
    const k = 0.04;
    for (const key of Object.keys(CFG.default)) cur[key] = lerp(cur[key], tgt[key], k);

    aY += cur.speed * 0.004;
    aX += (0.35 - aX) * 0.015;

    const asp = gl.canvas.width / gl.canvas.height;
    const proj  = perspective(0.87, asp, 0.1, 100);
    const view  = trans(-2.5);
    const model = mul(rotX(aX), rotY(aY));
    const mvp   = mul(proj, mul(view, model));
    const nm    = m3(model);

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.v);
    gl.enableVertexAttribArray(locs.aPos);
    gl.vertexAttribPointer(locs.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.n);
    gl.enableVertexAttribArray(locs.aNorm);
    gl.vertexAttribPointer(locs.aNorm, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.i);

    gl.uniformMatrix4fv(locs.uMVP,   false, mvp);
    gl.uniformMatrix4fv(locs.uModel, false, model);
    gl.uniformMatrix3fv(locs.uNorm,  false, nm);
    gl.uniform1f(locs.uTime,    uT * cur.speed);
    gl.uniform1f(locs.uAmp,     cur.amp);
    gl.uniform1f(locs.uFreq,    cur.freq);
    gl.uniform3f(locs.uColor,   cur.r, cur.g, cur.b);
    gl.uniform1f(locs.uCoreInt, cur.coreInt);
    gl.uniform1f(locs.uRimPow,  cur.rimPow);
    gl.uniform1f(locs.uESpeed,  cur.eSpeed);
    gl.uniform3f(locs.uCamPos,  0, 0, 2.5);

    gl.drawElements(gl.TRIANGLES, icnt, gl.UNSIGNED_SHORT, 0);
  }

  /* ═══ 2-D CANVAS FALLBACK ════════════════════════════════════
     Original particle sphere — runs when WebGL is unavailable.
     ══════════════════════════════════════════════════════════ */
  const CFG2D = {
    default:   { speed:0.004, rgb:[0,212,255],   alpha:0.70, sphereAmp:0,     sphereFreq:0,  pulseCore:0.06, coreAlpha:0.30 },
    speaking:  { speed:0.022, rgb:[200,240,255],  alpha:1.00, sphereAmp:0.05,  sphereFreq:18, pulseCore:0.18, coreAlpha:0.55 },
    thinking:  { speed:0.012, rgb:[0,160,255],    alpha:0.85, sphereAmp:0.02,  sphereFreq:6,  pulseCore:0.10, coreAlpha:0.40 },
    listening: { speed:0.005, rgb:[0,255,160],    alpha:0.80, sphereAmp:0.025, sphereFreq:4,  pulseCore:0.08, coreAlpha:0.35 },
    searching: { speed:0.018, rgb:[255,140,0],    alpha:0.90, sphereAmp:0.04,  sphereFreq:12, pulseCore:0.14, coreAlpha:0.45 },
  };
  const N=80, PHI=(1+Math.sqrt(5))/2, K_NEAR=5, BASE_R_PCT=0.42;

  function init2D(orbEl) {
    const core = orbEl.querySelector('.orb-core');
    if (core) core.remove();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;border-radius:50%;';
    orbEl.style.overflow = 'hidden';
    orbEl.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let points=[], edges=[], angleY=0, angleX=0.35, angleZ=0, t2=0;
    let stateName='default', curRGB=[0,212,255], tgtRGB=[0,212,255];

    function resizeCanvas() {
      const dpr=devicePixelRatio||1, w=orbEl.offsetWidth, h=orbEl.offsetHeight;
      canvas.width=w*dpr; canvas.height=h*dpr;
      canvas.style.width=w+'px'; canvas.style.height=h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resizeCanvas();
    window.ResizeObserver && new ResizeObserver(resizeCanvas).observe(orbEl);

    for (let i=0;i<N;i++) {
      const theta=Math.acos(1-2*(i+0.5)/N), phi=2*Math.PI*i/PHI;
      points.push({x:Math.sin(theta)*Math.cos(phi), y:Math.sin(theta)*Math.sin(phi), z:Math.cos(theta)});
    }
    const edgeSet=new Set();
    for (let i=0;i<N;i++) {
      const dists=points.map((q,j)=>{
        if(i===j) return{j,d:99};
        const dx=points[i].x-q.x,dy=points[i].y-q.y,dz=points[i].z-q.z;
        return{j,d:Math.sqrt(dx*dx+dy*dy+dz*dz)};
      });
      dists.sort((a,b)=>a.d-b.d);
      for(let k=0;k<K_NEAR;k++){const{j}=dists[k],key=i<j?`${i}_${j}`:`${j}_${i}`;edgeSet.add(key);}
    }
    edges=[...edgeSet].map(k=>k.split('_').map(Number));

    new MutationObserver(()=>{
      const cl=orbEl.classList;
      stateName=cl.contains('speaking')?'speaking':cl.contains('thinking')?'thinking':cl.contains('listening')?'listening':cl.contains('searching')?'searching':'default';
      tgtRGB=[...(CFG2D[stateName]||CFG2D.default).rgb];
    }).observe(orbEl,{attributes:true,attributeFilter:['class']});

    const rY=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return{x:p.x*c+p.z*s,y:p.y,z:-p.x*s+p.z*c};};
    const rX=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return{x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};};
    const rZ=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};
    const proj=(p,W,H,sR)=>{const fov=3.5,sc=fov/(fov+p.z);return{sx:W/2+p.x*sc*sR,sy:H/2+p.y*sc*sR,depth:(p.z+1)/2};};

    function loop2() {
      requestAnimationFrame(loop2);
      if(document.hidden) return;
      t2++;
      const cfg=CFG2D[stateName]||CFG2D.default;
      for(let i=0;i<3;i++) curRGB[i]=lerp(curRGB[i],tgtRGB[i],0.04);
      const [cr,cg,cb]=curRGB.map(v=>v|0);
      const dpr=devicePixelRatio||1, W=canvas.width/dpr, H=canvas.height/dpr, minD=Math.min(W,H);
      const spherePulse=cfg.sphereAmp>0?cfg.sphereAmp*Math.sin(t2*(cfg.sphereFreq/60)*Math.PI*2):0;
      const sphereR=minD*(BASE_R_PCT+spherePulse);
      angleY+=cfg.speed;
      if(stateName==='thinking'||stateName==='searching'){angleZ+=cfg.speed*0.5;angleX=0.35+0.12*Math.sin(t2*0.018);}
      else{angleZ=0;angleX+=(0.35-angleX)*0.015;}
      ctx.clearRect(0,0,W,H);
      const al=(cfg.alpha*0.07).toFixed(3);
      ctx.lineWidth=0.5; ctx.strokeStyle=`rgba(${cr},${cg},${cb},${al})`;
      const SEG=32;
      for(let i=1;i<=4;i++){
        const lat=(Math.PI/5)*i,r=Math.sin(lat),h=Math.cos(lat);
        ctx.beginPath();
        for(let s=0;s<=SEG;s++){const lon=2*Math.PI*s/SEG;let p={x:r*Math.cos(lon),y:h,z:r*Math.sin(lon)};let q=rY(p,angleY);q=rX(q,angleX);const{sx,sy}=proj(q,W,H,sphereR);s===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);}
        ctx.stroke();
      }
      const projs=points.map(p=>{let q=rY(p,angleY);q=rX(q,angleX);if(angleZ!==0)q=rZ(q,angleZ);return{...proj(q,W,H,sphereR)};});
      const sortedEdges=[...edges].sort((a,b)=>(projs[a[0]].depth+projs[a[1]].depth)-(projs[b[0]].depth+projs[b[1]].depth));
      for(const[i,j]of sortedEdges){const pi=projs[i],pj=projs[j],d=(pi.depth+pj.depth)*0.5,la=cfg.alpha*(0.06+0.22*d*d);ctx.beginPath();ctx.moveTo(pi.sx,pi.sy);ctx.lineTo(pj.sx,pj.sy);ctx.strokeStyle=`rgba(${cr},${cg},${cb},${la.toFixed(3)})`;ctx.lineWidth=0.4+0.5*d;ctx.stroke();}
      const order=[...projs.keys()].sort((a,b)=>projs[a].depth-projs[b].depth);
      for(const i of order){const{sx,sy,depth}=projs[i],a=cfg.alpha*(0.12+0.88*depth*depth),radius=(0.8+1.6*depth)*(1+spherePulse*0.5);if(depth>0.6){const glowR=radius*4,g=ctx.createRadialGradient(sx,sy,0,sx,sy,glowR);g.addColorStop(0,`rgba(${cr},${cg},${cb},${(a*0.35).toFixed(3)})`);g.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);ctx.beginPath();ctx.arc(sx,sy,glowR,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();}ctx.beginPath();ctx.arc(sx,sy,Math.max(radius,0.4),0,Math.PI*2);ctx.fillStyle=`rgba(${cr},${cg},${cb},${Math.min(a,1).toFixed(3)})`;ctx.fill();}
      const cx2=W/2,cy2=H/2,pulse=cfg.pulseCore*Math.sin(t2*0.09),cAlpha=cfg.coreAlpha+pulse,cR=minD*(0.13+Math.abs(spherePulse)*0.5);
      const gCore=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,cR);
      gCore.addColorStop(0,`rgba(${cr},${cg},${cb},${cAlpha.toFixed(3)})`);
      gCore.addColorStop(0.35,`rgba(${cr},${cg},${cb},${(cAlpha*0.4).toFixed(3)})`);
      gCore.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath();ctx.arc(cx2,cy2,cR,0,Math.PI*2);ctx.fillStyle=gCore;ctx.fill();
    }
    loop2();
  }

  /* ─── Boot ───────────────────────────────────────────────── */
  function init() {
    const el = document.getElementById('orb');
    if (!el) return;
    if (tryWebGL(el)) {
      (function loop() { requestAnimationFrame(loop); renderWebGL(); })();
    } else {
      init2D(el);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
