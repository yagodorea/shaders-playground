import { dot, Fn, If, instanceIndex, max, min, normalize, reflect, ShaderNodeObject, uint, vec3 } from "three/tsl";
import { StorageBufferNode } from "three/webgpu";
import { Uniforms } from "../types";
import { ShaderNodeFn } from "three/src/nodes/TSL.js";

export function computeGravity(
    positionBuffer: ShaderNodeObject<StorageBufferNode>,
    velocityBuffer: ShaderNodeObject<StorageBufferNode>,
    uniforms: Uniforms,
): ShaderNodeFn<[]> {
    return Fn(() => {
        const { gravity, friction, center, planetSize, bounce } = uniforms;
        const position = positionBuffer.element(instanceIndex);
        const velocity = velocityBuffer.element(instanceIndex);
        position.addAssign(velocity);

        const dv = position.sub(center);

        // Collision with planet
        const centerDist = dv.length();
        If(centerDist.lessThan(planetSize.div(2)), () => {
            const normal = dv.normalize();
            // Reflect velocity about surface normal and apply bounce dampening
            velocity.assign(reflect(velocity, normal).mul(bounce));
            // Push position to planet surface
            position.assign(center.add(normal.mul(planetSize.div(2))));
        });

        const normalizedDist = normalize(dv);
        // g = G * (m/r^2)
        const rSquared = max(dv.length(), 0.1);
        const g = max(gravity.mul(uint(1).div(rSquared)), 0.001).mul(-1);

        velocity.addAssign(normalizedDist.mul(g));
        const vel = velocity.length();
        const maxSpeed = .1;
        const velFinal = min(maxSpeed, vel);
        velocity.assign(normalize(velocity).mul(velFinal)).mul(friction);
    });
}