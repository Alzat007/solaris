uniform vec3 uColor;uniform float uOpacity;varying vec3 vNormal;varying vec3 vView;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.8);gl_FragColor=vec4(uColor,rim*uOpacity);}
