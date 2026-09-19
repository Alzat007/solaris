varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
uniform float uTime;
void main(){vPosition=position;vec3 p=position*(1.+.003*sin(uTime*1.7+position.y*6.));vec4 mv=modelViewMatrix*vec4(p,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}
