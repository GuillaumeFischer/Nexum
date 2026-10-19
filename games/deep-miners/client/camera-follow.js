// A close, frame-rate-independent follow keeps the scene responsive without
// moving the character's world position or changing its collision simulation.
export function followCamera(camera,target,seconds){
  if(!camera||Math.hypot(camera.x-target.x,camera.y-target.y)>5)return {x:target.x,y:target.y};
  const blend=1-Math.exp(-Math.max(0,Math.min(.1,seconds))*30);
  camera.x+=(target.x-camera.x)*blend;camera.y+=(target.y-camera.y)*blend;
  return camera;
}
