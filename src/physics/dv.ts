import { float, Fn, If, instanceIndex, length, Loop, max, min, normalize, ShaderNodeObject, step, uint, vec3 } from "three/tsl";
import { StorageBufferNode } from "three/webgpu";
import { Uniforms } from "../types";
import { ShaderNodeFn } from "three/src/nodes/TSL.js";

export function computeMovement(
    positionBuffer: ShaderNodeObject<StorageBufferNode>,
    velocityBuffer: ShaderNodeObject<StorageBufferNode>,
): ShaderNodeFn<[]> {
    return Fn(() => {
        const pos = positionBuffer.element(instanceIndex);
        const speed = velocityBuffer.element(instanceIndex);
    });
}