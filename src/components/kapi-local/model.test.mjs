import test from 'node:test';
import assert from 'node:assert/strict';
import { isKapiPreview, actorSize, bubbleHeightAt, rectAt, intersects, stageBounds, placeCompanion, walkingRoute, replyTo } from './model.mjs';

test('preview requires development, loopback, allowed route and explicit opt-in', () => {
  const base = { dev: true, hostname: '127.0.0.1', pathname: '/', search: '?kapiDemo=1' };
  assert.equal(isKapiPreview(base), true);
  for (const patch of [{ dev: false }, { hostname: 'wala.pe' }, { pathname: '/checkout' }, { search: '' }, { search: '?kapiDemo=0' }]) {
    assert.equal(isKapiPreview({ ...base, ...patch }), false);
  }
  assert.equal(isKapiPreview({ ...base, pathname: '/producto/product-1' }), true);
  assert.equal(isKapiPreview({ ...base, search: '', enabled: true, pathname: '/tienda' }), true);
  assert.equal(isKapiPreview({ ...base, search: '?kapiDemo=0', enabled: true }), false);
  assert.equal(isKapiPreview({ ...base, enabled: true, pathname: '/admin' }), false);
});

function checkPlacement(result, bounds, target) {
  for (const rect of [result.actor, result.bubble].filter(Boolean)) {
    assert.ok(rect.left >= bounds.left && rect.top >= bounds.top);
    assert.ok(rect.right <= bounds.right && rect.bottom <= bounds.bottom);
    assert.equal(intersects(rect, target, 12), false, 'overlay must leave the highlighted target and its outline clear');
  }
  assert.equal(intersects(result.actor, result.bubble, 8), false);
}

test('actor and hint avoid targets in the center, corners and full-width mobile header', () => {
  for (const [width,height] of [[320,640],[390,844],[768,1024],[844,390],[1440,900],[1920,883]]) {
    const viewport = { width,height }, actor = actorSize(width), bottomInset = width <= 768 ? 74 : 18;
    const bounds = stageBounds(viewport,bottomInset);
    const targets = [rectAt(8,8,width-16,90),rectAt(12,120,60,44),rectAt(width-72,120,60,44),rectAt(width/2-50,height/2-22,100,44),rectAt(0,height-56,width,56)];
    for (const target of targets) for (const x of [-100, width/2, width+100]) {
      const result = placeCompanion({viewport,actor,bubble:{width:224,height:103},preferred:{x,y:height-160},target,bottomInset});
      assert.ok(result.actor, 'a body should fit in these viewports');
      assert.ok(result.bubble, 'a short hint should fit in these viewports');
      checkPlacement(result,bounds,target);
    }
  }
});

test('long conversation fits short keyboard viewport or yields space safely', () => {
  for (const viewport of [{width:320,height:390},{width:390,height:450,top:200,left:0},{width:1440,height:600}]) {
    const bottomInset = viewport.width <= 768 ? 74 : 18;
    const target = rectAt(10,viewport.top || 0,viewport.width-20,50);
    const result = placeCompanion({viewport,actor:actorSize(viewport.width),bubble:{width:Math.min(300,viewport.width-24),height:320},target,bottomInset});
    checkPlacement(result,stageBounds(viewport,bottomInset),target);
  }
});

test('loading page content and its scrollbar do not relocate an open conversation', () => {
  const viewport = { width: 1440, height: 900 }, actor = actorSize(1440), bubble = { width: 300, height: 320 };
  const initial = placeCompanion({ viewport, actor, bubble, preferred: { x: 1316, y: 580 } });
  const loaded = placeCompanion({ viewport: { width: 1432, height: 900 }, actor, bubble,
    preferred: initial.actor, avoid: [rectAt(200,100,1200,800)], lockActor: true, preferredSide: initial.side });
  assert.equal(loaded.actor.y, initial.actor.y);
  assert.equal(loaded.actor.x, initial.actor.x - 8);
  assert.equal(loaded.side, initial.side);
  checkPlacement(loaded, stageBounds({width:1432,height:900}), null);
  const guided = placeCompanion({ viewport, actor, bubble, preferred: initial.actor, lockActor: true, target: initial.actor });
  assert.equal(intersects(guided.actor, initial.actor, 12), false, 'a real guide still relocates away from its target');
});

test('opening, growing and closing a balloon keep a stationary actor in place', () => {
  for (const viewport of [{width:390,height:844},{width:1280,height:720},{width:1858,height:942}]) {
    const actor = actorSize(viewport.width), bottomInset = viewport.width <= 768 ? 74 : 18;
    const bounds = stageBounds(viewport,bottomInset), width = Math.min(300,viewport.width-24);
    for (const point of [{x:bounds.left,y:bounds.top},{x:bounds.right-actor.width,y:bounds.bottom-actor.height},
      {x:(bounds.left+bounds.right-actor.width)/2,y:(bounds.top+bounds.bottom-actor.height)/2}]) {
      const contentHeight = bubbleHeightAt({viewport,actor,point,width,bottomInset});
      assert.ok(contentHeight >= 160, 'normal mobile and desktop layouts keep a usable chat');
      for (const height of [100,260,360]) {
        const result = placeCompanion({viewport,actor,bottomInset,preferred:point,lockActor:true,
          bubble:{width,height:Math.min(height,contentHeight+2)},avoid:[rectAt(0,0,viewport.width,viewport.height)]});
        assert.ok(result.bubble, 'a long reply shrinks instead of hiding the chat');
        assert.equal(result.actor.x,point.x); assert.equal(result.actor.y,point.y);
        checkPlacement(result,bounds,null);
      }
      const closed = placeCompanion({viewport,actor,bottomInset,preferred:point,lockActor:true});
      assert.equal(closed.actor.x,point.x); assert.equal(closed.actor.y,point.y);
    }
  }
});

test('insufficient space never falls back to covering the protected content', () => {
  const viewport = {width:320,height:250}, actor = actorSize(320);
  assert.deepEqual(placeCompanion({viewport,actor,bubble:{width:224,height:80},target:rectAt(0,0,320,250)}),{actor:null,bubble:null});
  const result = placeCompanion({viewport,actor,bubble:{width:300,height:400}});
  assert.ok(result.actor);
  assert.equal(result.bubble,null);
});

test('narrow-screen hint prefers empty space over the hero heading and buy button', () => {
  const viewport = {width:312,height:640};
  const avoid = [rectAt(0,0,312,120),rectAt(24,300,264,65),rectAt(24,380,264,40),rectAt(58,446,196,52)];
  const result = placeCompanion({viewport,actor:actorSize(312),bubble:{width:184,height:80},target:rectAt(246,20,40,40),avoid,bottomInset:74});
  assert.ok(result.actor && result.bubble);
  for (const rect of avoid) {
    assert.equal(intersects(result.actor,rect),false);
    assert.equal(intersects(result.bubble,rect),false);
  }
});

test('walk goes around a protected button and refuses an already overlapping starting point', () => {
  const actor = {width:88,height:118}, bounds = stageBounds({width:600,height:700},74);
  const target = rectAt(220,300,120,60), from = {x:30,y:270}, to = {x:450,y:270};
  const route = walkingRoute(from,to,actor,target,bounds);
  assert.ok(route?.length);
  let previous = from;
  for (const point of route) {
    const swept = rectAt(Math.min(previous.x,point.x),Math.min(previous.y,point.y),Math.abs(previous.x-point.x)+actor.width,Math.abs(previous.y-point.y)+actor.height);
    assert.equal(intersects(swept,target,12),false);
    previous = point;
  }
  assert.deepEqual(previous,to);
  assert.equal(walkingRoute({x:240,y:300},to,actor,target,bounds),null);
});

test('guidance approaches a central control instead of staying at either screen edge', () => {
  const viewport = {width:1440,height:900}, actor = actorSize(1440), target = rectAt(620,420,200,52);
  for (const x of [12,1316]) {
    const result = placeCompanion({viewport,actor,bubble:{width:224,height:62},preferred:{x,y:730},target});
    checkPlacement(result,stageBounds(viewport),target);
    assert.ok(result.bubble);
    const gap = Math.max(target.left-result.actor.right,result.actor.left-target.right,0);
    assert.ok(gap >= 12 && gap <= 24, 'stop next to the button, with breathing room');
    const handY = result.actor.top + actor.height * .4;
    assert.ok(handY >= target.top && handY <= target.bottom, 'pointing pose aligns with the button');
    const validation = placeCompanion({viewport,actor,preferred:result.actor,target,nearTarget:false});
    assert.equal(validation.actor.x,result.actor.x);
    assert.equal(validation.actor.y,result.actor.y);
  }
});

test('guidance chooses the clear side when nearby text blocks the other side', () => {
  const viewport = {width:1440,height:900}, target = rectAt(620,420,200,52), avoid = [rectAt(280,320,320,300)];
  const result = placeCompanion({viewport,actor:actorSize(1440),bubble:{width:224,height:80},preferred:{x:12,y:730},target,avoid});
  assert.ok(result.actor.left >= target.right+12 && result.actor.left <= target.right+24);
  for (const rect of [result.actor,result.bubble]) assert.equal(intersects(rect,avoid[0],6),false);
});

test('dense content is never covered to force a nearby explanation', () => {
  const viewport = {width:390,height:844};
  const result = placeCompanion({viewport,actor:actorSize(390),bubble:{width:224,height:100},target:rectAt(10,10,100,40),avoid:[rectAt(0,0,390,844)]});
  assert.deepEqual(result,{actor:null,bubble:null});
});

test('guided walking also leaves neighboring important text clear', () => {
  const actor = {width:88,height:118}, bounds = stageBounds({width:800,height:700},74);
  const target = rectAt(600,300,100,60), avoid = [rectAt(220,250,150,140)];
  const from = {x:30,y:270}, to = {x:496,y:270};
  const route = walkingRoute(from,to,actor,target,bounds,avoid);
  assert.ok(route?.length);
  let previous = from;
  for (const point of route) {
    const swept = rectAt(Math.min(previous.x,point.x),Math.min(previous.y,point.y),Math.abs(previous.x-point.x)+actor.width,Math.abs(previous.y-point.y)+actor.height);
    assert.equal(intersects(swept,avoid[0],6),false);
    assert.equal(intersects(swept,target,12),false);
    previous = point;
  }
});

test('scripted messages guide without claiming a transaction or inventing products', () => {
  assert.deepEqual(replyTo('Quiero pagar'), { target: 'cart' });
  assert.deepEqual(replyTo('¿Dónde está el CATÁLOGO?'), { target: 'store' });
  assert.deepEqual(replyTo('Quiero personalizar'), { target: 'create' });
  assert.match(replyTo('¿Mi pedido llegará mañana?').text, /Todavía estoy aprendiendo/);
});
