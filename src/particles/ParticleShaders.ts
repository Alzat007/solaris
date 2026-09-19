export const particleVertex = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uTime,uCollapse,uExplosion,uBurst,uIntro,uInfluence,uPinch,uState,uSize,uOpacity,uAssembly;
uniform vec3 uHand,uVelocity;
varying float vAlpha,vHeat;
void main(){
 vec3 p=position;
 float seed=aSeed;
 float a=uTime*(.012+seed*.025);
 mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));p.xz=rot*p.xz;
 p.y+=sin(uTime*.25+seed*120.)*.08;
 p*=1.+uAssembly*(1.+seed*2.);
 p.xz=mat2(cos(uAssembly*seed*3.),-sin(uAssembly*seed*3.),sin(uAssembly*seed*3.),cos(uAssembly*seed*3.))*p.xz;
 vec3 toHand=p-uHand;float dist=length(toHand);
 float field=exp(-dist*dist*.095)*uInfluence;
 vec3 dir=normalize(toHand+vec3(.001));
 float speed=min(length(uVelocity),12.);
 float polarity=uState>1.5&&uState<2.5?-1.:1.-uPinch*2.;
 p+=dir*field*(1.3+speed*.18)*polarity;
 p+=cross(vec3(0.,1.,0.),dir)*field*(.6+speed*.08)*(uState>3.5&&uState<4.5?3.:1.);
 p+=uVelocity*field*.08;
 p*=mix(.01,1.,smoothstep(0.,1.,uIntro));
 p*=1.-uCollapse*.994;
 float blast=sin(min(uExplosion*1.35,1.)*3.14159)*step(.0001,uExplosion);
 p+=normalize(position+vec3(.001))*blast*(18.+seed*38.);
 p+=normalize(position+vec3(.001))*uBurst*seed*5.;
 vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(aSize*uSize*(200./max(1.,-mv.z))*(1.+uCollapse*1.5+uBurst*.7),.65,20.);
 vAlpha=uOpacity*(.3+seed*.7)*(1.-blast*.55);
 vHeat=seed;
}
`;
export const particleFragment = /* glsl */ `
uniform vec3 uColor;varying float vAlpha,vHeat;
void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=pow(1.-d,2.2);vec3 c=mix(uColor,uColor*1.6+vec3(.18),vHeat*.5);gl_FragColor=vec4(c,glow*vAlpha);}
`;
export const ringVertex = /* glsl */ `
attribute float aSeed;attribute float aSize;
uniform float uTime,uInfluence,uSize,uOpacity,uAssembly;uniform vec3 uHand,uVelocity;
varying float vAlpha,vHeat;
void main(){vec3 p=position;float a=uTime*(.018+aSeed*.025);p.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
vec3 d=p-uHand;float l=length(d);float f=exp(-l*l*1.1)*uInfluence;
p+=normalize(d+vec3(.001))*f*.85;p.y+=sin(l*8.-uTime*5.)*f*.24;p+=uVelocity*f*.025;
vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uSize*110./max(-mv.z,1.),.65,5.);vAlpha=uOpacity*(.35+.65*aSeed);vHeat=aSeed;}
`;
