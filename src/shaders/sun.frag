uniform float uTime;
uniform float uOpacity;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vView;
void main(){
 vec3 p=vPosition*2.4;
 float flow=fbm(p*.85+vec3(0.,uTime*.08,uTime*.025));
 float n=fbm(p*3.2+flow*2.5+vec3(uTime*.04,-uTime*.06,0.));
 float fine=noise3(p*35.+n*2.5+uTime*.18);
 float cells=pow(abs(sin((n*.85+flow*.5)*22.)),5.);
 float heat=clamp(n*.9+flow*.35+fine*.12-cells*.1,0.,1.);
 vec3 color=mix(vec3(.7,.055,.004),vec3(1.9,.36,.025),smoothstep(.24,.6,heat));
 color=mix(color,vec3(2.8,1.0,.17),smoothstep(.57,.84,heat));
 float limb=pow(max(dot(normalize(vNormal),normalize(vView)),0.),.36);
 color*=.43+limb*.65;
 float filaments=pow(1.-abs(sin(n*29.+flow*7.)),12.);
 color+=vec3(1.,.2,.01)*filaments*.25;
 gl_FragColor=vec4(color,uOpacity);
}
