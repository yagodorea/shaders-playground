import { float, Fn, If, instanceIndex, length, Loop, max, min, normalize, ShaderNodeObject, step, uint, vec3 } from "three/tsl";
import { StorageBufferNode } from "three/webgpu";
import { Uniforms } from "../types";
import { ShaderNodeFn } from "three/src/nodes/TSL.js";

export function computeCollision(
    positionBuffer: ShaderNodeObject<StorageBufferNode>,
    velocityBuffer: ShaderNodeObject<StorageBufferNode>,
    uniforms: Uniforms,
    particleCount: number,
): ShaderNodeFn<[]> {
    return Fn(() => {
        const { size, planetSize, bounce, center } = uniforms;
        const pos = positionBuffer.element(instanceIndex);
        const speed = velocityBuffer.element(instanceIndex);

        // // Collision with planet
        // const dv = pos.sub(center);
        // const centerDist = dv.length();
        // If(centerDist.lessThan(planetSize.div(2)), () => {
        //     const curSpeed = speed.length();
        //     speed.assign(dv.normalize().mul(curSpeed).mul(bounce).mul(-1).mul(10000));
        //     pos.addAssign(dv);
        //     // const normalDist = dv.normalize();
        //     // speed.assign(normalDist.mul(-1).mul(speed.length()).mul(bounce));
        // });

        // Collision with each other
        Loop({ start: uint(0), end: particleCount, type: 'uint', condition: '<' }, ({ i }) => {
            const pos2 = positionBuffer.element(i);
            const speed2 = velocityBuffer.element(i);
            If(instanceIndex.notEqual(i), () => {
                const dv = pos2.sub(pos);
                const dist = dv.length();
                const minDistance = size;
                If(dist.lessThan(minDistance), () => {
                    const diff = minDistance.sub(dist);
                    const correction = dv.normalize().mul(diff.mul(bounce));
                    const velCorrection1 = correction.mul(max(length(speed), 2));
                    const velCorrection2 = correction.mul(max(length(speed2), 2));

                    pos.subAssign(correction.mul(float(2).sub(step(speed2.w, 1))));
                    speed.subAssign(velCorrection1);

                    pos2.subAssign(correction.mul(float(2).sub(step(speed.w, 1))));
                    speed2.subAssign(velCorrection2);
                });
            });
        });
    });
}