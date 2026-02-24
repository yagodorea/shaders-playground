import { ShaderNodeObject } from "three/tsl"
import { UniformNode, Vector3 } from "three/webgpu"

export interface Uniforms {
    time: ShaderNodeObject<UniformNode<number>>;
    gravity: ShaderNodeObject<UniformNode<number>>;
    bounce: ShaderNodeObject<UniformNode<number>>;
    friction: ShaderNodeObject<UniformNode<number>>;
    size: ShaderNodeObject<UniformNode<number>>;
    clickPosition: ShaderNodeObject<UniformNode<Vector3>>;
    planetSize: ShaderNodeObject<UniformNode<number>>;
    center: ShaderNodeObject<UniformNode<Vector3>>;
}