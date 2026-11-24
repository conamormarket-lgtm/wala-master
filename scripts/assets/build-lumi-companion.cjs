// Package six Lumi gestures from generated transparent atlases with optical flow.
// One consistent artwork scale; premultiplied alpha throughout.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const tools = process.env.KAPI_ANIMATION_TOOLS;
const sharp = require(tools ? path.join(tools, 'sharp') : 'sharp');
const cvModule = require(tools ? path.join(tools, '@techstark/opencv-js') : '@techstark/opencv-js');
const out = path.resolve('output/imagegen/lumi-cuyita-v1');
const input = path.resolve(out, 'keyframes');
const W = 256, H = 256;

async function getCv() {
  let cv;
  if (cvModule instanceof Promise) cv = await cvModule;
  else if (cvModule.Mat) cv = cvModule;
  else { await new Promise(resolve => { cvModule.onRuntimeInitialized = resolve; }); cv = cvModule; }
  return { cv };
}

function gray(cv, rgba) {
  const mat = new cv.Mat(H, W, cv.CV_8UC1);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4, a = rgba[i + 3] / 255;
    mat.data[p] = Math.round((0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 215 * (1 - a));
  }
  return mat;
}

function sample(array, x, y, channels, dest) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) { dest.fill(0); return dest; }
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const wx = x - x0, wy = y - y0;
  const a = (y0 * W + x0) * channels, b = (y0 * W + x1) * channels;
  const c = (y1 * W + x0) * channels, d = (y1 * W + x1) * channels;
  for (let k = 0; k < channels; k++) dest[k] = (array[a + k] * (1 - wx) + array[b + k] * wx) * (1 - wy) + (array[c + k] * (1 - wx) + array[d + k] * wx) * wy;
  return dest;
}

function premultiply(rgba) {
  const out = new Float32Array(rgba.length);
  for (let p = 0; p < rgba.length; p += 4) {
    const a = rgba[p + 3] / 255;
    out[p] = rgba[p] * a; out[p + 1] = rgba[p + 1] * a; out[p + 2] = rgba[p + 2] * a; out[p + 3] = rgba[p + 3];
  }
  return out;
}

function between(a, b, forward, backward, t) {
  const result = Buffer.alloc(W * H * 4);
  const f = new Float64Array(2), g = new Float64Array(2);
  const pa = new Float64Array(4), pb = new Float64Array(4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let ax = x, ay = y, bx = x, by = y;
    // Invert each motion field at the desired intermediate position.
    for (let it = 0; it < 3; it++) {
      sample(forward, ax, ay, 2, f);
      sample(backward, bx, by, 2, g);
      ax = x - t * f[0]; ay = y - t * f[1];
      bx = x - (1 - t) * g[0]; by = y - (1 - t) * g[1];
    }
    sample(a, ax, ay, 4, pa); sample(b, bx, by, 4, pb);
    const p = (y * W + x) * 4;
    // Render a warped solid pose instead of dissolving two different limb
    // silhouettes. A dissolve creates translucent duplicate hands/feet.
    const chosen = t < 0.5 ? pa : pb;
    // Blend aligned opaque interiors smoothly without ghosting limb silhouettes.
    if(pa[3]>220 && pb[3]>220 && Math.max(...[0,1,2].map(k=>Math.abs(pa[k]-pb[k])))<60) for(let k=0;k<4;k++) chosen[k]=pa[k]*(1-t)+pb[k]*t;
    const alpha = chosen[3];
    result[p + 3] = Math.round(alpha);
    if (alpha > 0.5) for (let k = 0; k < 3; k++) result[p + k] = Math.max(0, Math.min(255, Math.round(chosen[k] * 255 / alpha)));
  }
  return result;
}

async function poses(file, columns, rows, row = null) {
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // Generated alpha contains near-zero background noise. Preserve soft edges,
  // but normalize invisible pixels before cell extraction and optical flow.
  for(let p=0;p<data.length;p+=4) if(data[p+3]<=12) data.fill(0,p,p+4);
  const cells=[];
  for(let r=row??0;r<(row===null?rows:row+1);r++) for(let c=0;c<columns;c++) {
    const left=Math.round(c*info.width/columns),top=Math.round(r*info.height/rows);
    const width=Math.round((c+1)*info.width/columns)-left,height=Math.round((r+1)*info.height/rows)-top;
    const cell=await sharp(data,{raw:info}).extract({left,top,width,height}).png().toBuffer();
    const trimmed=await sharp(cell).trim({threshold:12}).toBuffer({resolveWithObject:true});
    const scaled=await sharp(trimmed.data).resize({height:226,width:220,fit:'inside'}).png().toBuffer({resolveWithObject:true});
    cells.push(await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}})
      .composite([{input:scaled.data,left:Math.round((W-scaled.info.width)/2),top:244-scaled.info.height}]).raw().toBuffer());
  }
  return cells;
}

async function main(){
  const {cv}=await getCv();
  const dest=path.resolve('public/assets/companions/lumi-v1');
  await fs.mkdir(dest,{recursive:true});
  const names=['idle','walk','wave','talk','think','point'];
  const labels=['En reposo','Caminar','Saludar','Hablar','Pensar','Señalar'];
  const manifest={}, checks=[];
  for(const [row,name] of names.entries()){
    const originals=name==='walk'?await poses(path.join(out,'walk-atlas.png'),4,2):await poses(path.join(out,'atlas.png'),6,6,row);
    const grayMats=originals.map(p=>gray(cv,p)),premul=originals.map(premultiply),frames=[],delays=[];
    for(let from=0;from<originals.length;from++){
      const to=(from+1)%originals.length,forward=new cv.Mat(),backward=new cv.Mat();
      cv.calcOpticalFlowFarneback(grayMats[from],grayMats[to],forward,.5,4,25,5,7,1.5,0);
      cv.calcOpticalFlowFarneback(grayMats[to],grayMats[from],backward,.5,4,25,5,7,1.5,0);
      for(let j=0;j<8;j++){
        frames.push(j===0?originals[from]:between(premul[from],premul[to],forward.data32F,backward.data32F,j/8));
        delays.push(name==='walk'?20:name==='idle'?40:30);
      }
      if((name==='point'||name==='think')&&from===2){frames.push(originals[3]);delays.push(500);}
      forward.delete();backward.delete();
    }
    if(name==='idle'){frames.push(originals[0]);delays.push(900);}
    grayMats.forEach(m=>m.delete());
    const raw={width:W,height:H*frames.length,channels:4,pageHeight:H};
    await sharp(Buffer.concat(frames),{raw}).webp({quality:88,alphaQuality:100,loop:0,delay:delays,effort:5}).toFile(path.join(dest,name+'.webp'));
    await sharp(originals[0],{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(dest,name+'.png'));
    if(name==='point') await sharp(originals[3],{raw:{width:W,height:H,channels:4}}).png().toFile(path.join(dest,'point-hold.png'));
    if(name==='wave'||name==='walk') await sharp(Buffer.concat(frames),{raw}).gif({loop:0,delay:delays,colours:256,dither:.1}).toFile(path.join(out,name+'.gif'));
    const meta=await sharp(path.join(dest,name+'.webp'),{animated:true}).metadata();
    if(!meta.hasAlpha||meta.loop!==0||meta.pages<40)throw Error('Invalid animation '+name);
    manifest[name]={label:labels[row],src:`/assets/companions/lumi-v1/${name}.webp`,still:`/assets/companions/lumi-v1/${name}.png`,duration:delays.reduce((a,b)=>a+b,0),frames:frames.length};
    if(name==='point')Object.assign(manifest[name],{hold:'/assets/companions/lumi-v1/point-hold.png',holdAfter:720});
    checks.push({name,frames:meta.pages,duration:manifest[name].duration,alpha:meta.hasAlpha,bytes:(await fs.stat(path.join(dest,name+'.webp'))).size});
    console.log(JSON.stringify(checks.at(-1)));
  }
  await fs.writeFile(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2));
  await fs.writeFile(path.join(out,'verification.json'),JSON.stringify({checks,method:'Generated keyframes, alpha-preserving optical-flow interpolation; original Kapi pipeline adapted for Lumi'},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
