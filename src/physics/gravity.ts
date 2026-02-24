import { Fn, If, instanceIndex, max, min, normalize, ShaderNodeObject, uint, vec3 } from "three/tsl";
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
            const curSpeed = velocity.length();
            // TODO: reflect
            velocity.assign(velocity.negate().mul(10));
            position.assign(center.add(dv));

            // const normalDist = dv.normalize();
            // speed.assign(normalDist.mul(-1).mul(speed.length()).mul(bounce));
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