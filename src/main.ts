import { Color, ComputeNode, GridHelper, Mesh, MeshBasicMaterial, MeshSSSNodeMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, SphereGeometry, SpriteNodeMaterial, Texture, TextureLoader, TimestampQuery, UniformNode, Vector2, Vector3, WebGPURenderer } from "three/webgpu";
import { Fn, uniform, texture, instancedArray, instanceIndex, float, hash, vec3, If, uint, min, max, normalize, sin, sinc, PI, cos, tan, sqrt, log, pow } from 'three/tsl';
import GUI from "lil-gui";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { ShaderNodeFn, ShaderNodeObject } from "three/src/nodes/TSL.js";
import { Uniforms } from "./types";
import { computeGravity } from "./physics/gravity";
import { computeCollision } from "./physics/collision";
import { computeMovement } from "./physics/dv";

const loadTexture = async (url): Promise<Texture> => {
    let textureLoader = new TextureLoader()
    return new Promise(resolve => {
        textureLoader.load(url, texture => {
            resolve(texture)
        })
    })
}

export class World {
    renderer: WebGPURenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    controls: OrbitControls;
    pointer: Vector2;
    raycaster: Raycaster;
    uniforms: Uniforms;
    computeInit: ComputeNode;
    computeClick: ComputeNode;
    computeGravity: ComputeNode;
    computeCollision: ComputeNode;
    computeMovement: ComputeNode;

    stats: Stats;

    timestamps: any;
    isPaused: boolean = true;

    planet: Mesh;

    constructor() {
        this.uniforms = {} as any;
        this.uniforms.gravity = uniform(-0.00098);
        this.uniforms.bounce = uniform(.9);
        this.uniforms.friction = uniform(.50);
        this.uniforms.size = uniform(.32);
        this.uniforms.clickPosition = uniform(new Vector3());
        this.uniforms.planetSize = uniform(10);
        this.uniforms.time = uniform(0);
        this.uniforms.center = uniform(new Vector3(0, 0, 0));
        // this.uniforms.center = uniform(new Vector3(
        //     this.uniforms.planetSize.value * 2 * Math.sin(0),
        //     0,
        //     this.uniforms.planetSize.value * 2 * Math.cos(0)
        // ));
    }

    async initialize() {
        const particleCount = 2000;

        let cloudRadius = 30;
        let innerRadius = 20;

        this.timestamps = document.getElementById('timestamps');

        const { innerWidth, innerHeight } = window;

        this.camera = new PerspectiveCamera(50, innerWidth / innerHeight, .1, 1000);
        this.camera.position.set(15, 10, 30);

        this.scene = new Scene();


        const positionBuffer = instancedArray(particleCount, 'vec3');
        const velocityBuffer = instancedArray(particleCount, 'vec3');
        const colorBuffer = instancedArray(particleCount, 'vec3');

        const helper = new GridHelper(60, 40, 0x303030, 0x303030);
        // scene.add(helper);

        this.computeInit = Fn(() => {

            const position = positionBuffer.element(instanceIndex);
            const color = colorBuffer.element(instanceIndex);

            const randX = hash(instanceIndex);
            const randY = hash(instanceIndex.add(2));
            const randZ = hash(instanceIndex.add(3));
            // Cube
            // position.x = randX.mul(100).add(-50);
            // position.y = randY.mul(100).add(-50);
            // position.z = randZ.mul(100).add(-50);

            // "Sphere"
            const r = uint(cloudRadius);
            const innerR = uint(innerRadius);
            const inclination = hash(instanceIndex.mul(100)).mul(PI);
            const azimuth = hash(instanceIndex.mul(200)).mul(PI).mul(2);
            position.x = randX.mul(r).mul(sin(inclination)).mul(cos(azimuth));
            position.y = randY.mul(r).mul(sin(inclination)).mul(sin(azimuth));
            position.z = randZ.mul(r).mul(cos(inclination));

            If(position.length().lessThan(innerR), () => {
                position.xyz.addAssign(position.xyz.normalize().mul(innerR));
            });

            color.assign(vec3(randX, randY, randZ));

        })().compute(particleCount);

        this.computeGravity = computeGravity(positionBuffer, velocityBuffer, this.uniforms)().compute(particleCount);
        this.computeCollision = computeCollision(positionBuffer, velocityBuffer, this.uniforms, particleCount)().compute(particleCount);
        this.computeMovement = computeMovement(positionBuffer, velocityBuffer)().compute(particleCount);

        const textureLoader = new TextureLoader();

        // create particles
        const particleMaterial = new SpriteNodeMaterial();
        const map = textureLoader.load('textures/sprite1.png');
        const textureNode = texture(map);
        particleMaterial.colorNode = textureNode.mul(colorBuffer.element(instanceIndex));
        // @ts-ignore
        particleMaterial.positionNode = positionBuffer.toAttribute();
        particleMaterial.scaleNode = this.uniforms.size;
        particleMaterial.depthWrite = false;
        particleMaterial.depthTest = true;
        particleMaterial.transparent = true;

        const particles = new Mesh(new PlaneGeometry(1, 1), particleMaterial);
        particles.count = particleCount;
        particles.frustumCulled = false;
        this.scene.add(particles);

        // const geometry = new PlaneGeometry(1000, 1000);
        // geometry.rotateX(- Math.PI / 2);

        // const plane = new Mesh(geometry, new MeshBasicMaterial({ visible: false }));
        // scene.add(plane);

        const planetMap = await loadTexture('./textures/earth.jpg');
        const planetGeometry = new SphereGeometry(this.uniforms.planetSize.value / 2, 64, 64);
        const planetMaterial = new MeshBasicMaterial({
            map: planetMap,
            // visible: false,
        });
        this.planet = new Mesh(planetGeometry, planetMaterial);;
        this.planet.position.set(
            this.uniforms.center.value.x,
            this.uniforms.center.value.y,
            this.uniforms.center.value.z,
        );
        this.scene.add(this.planet);

        this.raycaster = new Raycaster();
        this.pointer = new Vector2();

        //

        this.renderer = new WebGPURenderer({ antialias: true, trackTimestamp: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setAnimationLoop(this.animate);
        document.body.appendChild(this.renderer.domElement);

        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);

        //

        this.renderer.computeAsync(this.computeInit);

        // click event

        this.computeClick = Fn(() => {

            const position = positionBuffer.element(instanceIndex);
            const velocity = velocityBuffer.element(instanceIndex);

            const dist = position.distance(this.uniforms.clickPosition);
            const direction = position.sub(this.uniforms.clickPosition).normalize();
            const distArea = float(6).sub(dist).max(0);

            const power = distArea.mul(.01);
            const relativePower = power.mul(hash(instanceIndex).mul(.5).add(.5));

            velocity.assign(velocity.add(direction.mul(relativePower)));

        })().compute(particleCount);

        //

        // events

        this.renderer.domElement.addEventListener('pointermove', this.onMove);
        window.addEventListener('keydown', (ev) => {
            if (ev.code === 'Space') {
                this.isPaused = !this.isPaused;
            }
        })

        //

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = 5;
        this.controls.maxDistance = 200;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        //

        window.addEventListener('resize', this.onWindowResize);

        // gui

        const gui = new GUI();

        gui.add(this.uniforms.gravity, 'value', - .0000098, 0, 0.0001).name('gravity');
        gui.add(this.uniforms.bounce, 'value', .1, 1, 0.01).name('bounce');
        gui.add(this.uniforms.friction, 'value', .96, .99, 0.01).name('friction');
        gui.add(this.uniforms.size, 'value', .12, .5, 0.01).name('size');
        gui.add(this.uniforms.planetSize, 'value', 0.1, 100, .01).name('planetSize').onChange((size) => {
            const scale = size / 10;
            this.planet.scale.set(scale, scale, scale);
        });
    }

    setPlanet = async (x: number, y: number, z: number) => {
        this.uniforms.center.value.x = x;
        this.uniforms.center.value.y = y;
        this.uniforms.center.value.z = z;
        this.planet.position.set(
            this.uniforms.center.value.x,
            this.uniforms.center.value.y,
            this.uniforms.center.value.z,
        );
    };

    animate = async () => {
        this.stats.update();

        if (!this.isPaused) {
            this.uniforms.time.value += 0.45;
            // await this.renderer.computeAsync(this.computeMovement);
            // await this.renderer.computeAsync(this.computeCollision);
            await this.renderer.computeAsync(this.computeGravity);
            this.renderer.resolveTimestampsAsync(TimestampQuery.COMPUTE);
            // this.setPlanet(
            //     this.uniforms.planetSize.value * 2 * Math.sin(this.uniforms.time.value),
            //     0,
            //     this.uniforms.planetSize.value * 2 * Math.cos(this.uniforms.time.value)
            // );
            // this.isPaused = true;
        }
        await this.renderer.renderAsync(this.scene, this.camera);
        this.renderer.resolveTimestampsAsync(TimestampQuery.RENDER);

        // throttle the logging
        if (this.renderer.hasFeature('timestamp-query')) {
            if (this.renderer.info.render.calls % 5 === 0) {
                this.timestamps.innerHTML = `
                    Compute ${this.renderer.info.compute.frameCalls} pass in ${this.renderer.info.compute.timestamp.toFixed(6)}ms<br>
                    Draw ${this.renderer.info.render.drawCalls} pass in ${this.renderer.info.render.timestamp.toFixed(6)}ms`;
            }
        } else {
            this.timestamps.innerHTML = 'Timestamp queries not supported';
        }
    }

    onWindowResize = () => {
        const { innerWidth, innerHeight } = window;
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
    }

    onMove = (event) => {
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = - (event.clientY / window.innerHeight) * 2 + 1;
        this.pointer.set(x, y);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.setPlanet(x * 50, 0, -y * 50);

        const intersects = [];// raycaster.intersectObjects([plane], false);

        if (intersects.length > 0) {
            const { point } = intersects[0];

            // move to uniform
            this.uniforms.clickPosition.value.copy(point);
            this.uniforms.clickPosition.value.y = - 1;

            // compute
            this.renderer.computeAsync(this.computeClick);
        }

    }
}

new World().initialize();