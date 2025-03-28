import * as THREE from 'three';
import * as YUKA from 'yuka';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader';

const renderer = new THREE.WebGLRenderer({antialias: true});

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

renderer.setClearColor(0xA3A3A3);

const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(0, 10, 15);
camera.lookAt(scene.position);

const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
directionalLight.position.set(0, 10, 10);
scene.add(directionalLight);

const vehicle = new YUKA.Vehicle();

function sync(entity, renderComponent) {
    renderComponent.matrix.copy(entity.worldMatrix);
}

// Fonction pour vérifier si deux segments se croisent
function segmentsIntersect(p1, p2, p3, p4) {
    function ccw(A, B, C) {
        return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
    }
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

// Fonction pour générer un point aléatoire dans un cercle
function generateRandomPoint(radius) {
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    return new YUKA.Vector3(
        r * Math.cos(theta),
        0,
        r * Math.sin(theta)
    );
}

// Fonction pour générer un chemin sans croisements
function generateNonIntersectingPath(numPoints, radius) {
    const path = new YUKA.Path();
    let attempts = 0;
    const maxAttempts = 1000;
    
    while (path._waypoints.length < numPoints && attempts < maxAttempts) {
        const newPoint = generateRandomPoint(radius);
        let isValid = true;
        
        // Vérifier si le nouveau point crée une intersection avec les segments existants
        if (path._waypoints.length >= 2) {
            for (let i = 0; i < path._waypoints.length - 1; i++) {
                const p1 = path._waypoints[i];
                const p2 = path._waypoints[i + 1];
                const p3 = path._waypoints[path._waypoints.length - 1];
                const p4 = newPoint;
                
                if (segmentsIntersect(p1, p2, p3, p4)) {
                    isValid = false;
                    break;
                }
            }
        }
        
        if (isValid) {
            path.add(newPoint);
        }
        attempts++;
    }
    
    return path;
}

// Créer un circuit prédéfini
const path = new YUKA.Path();
path.add( new YUKA.Vector3(-6, 0, 4));
path.add( new YUKA.Vector3(-12, 0, 0));
path.add( new YUKA.Vector3(-6, 0, -12));
path.add( new YUKA.Vector3(0, 0, 0));
path.add( new YUKA.Vector3(8, 0, -8));
path.add( new YUKA.Vector3(10, 0, 0));
path.add( new YUKA.Vector3(4, 0, 4));
path.add( new YUKA.Vector3(0, 0, 6));
path.loop = true;

vehicle.position.copy(path.current());

// Créer une texture pour la ligne blanche
const lineTexture = new THREE.TextureLoader().load('./assets/line.png');
lineTexture.wrapS = THREE.RepeatWrapping;
lineTexture.wrapT = THREE.RepeatWrapping;
lineTexture.repeat.set(1, 1);

// Modifier le matériau de la ligne pour qu'il soit plus visible
const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xFFFFFF,
    linewidth: 2,
    map: lineTexture
});

// Modifier les comportements de suivi
const followPathBehavior = new YUKA.FollowPathBehavior(path, 3); // Distance de suivi
vehicle.steering.add(followPathBehavior);

const onPathBehavior = new YUKA.OnPathBehavior(path);
onPathBehavior.radius = 3; // Rayon de tolérance
vehicle.steering.add(onPathBehavior);

// Vitesse du véhicule
vehicle.maxSpeed = 3;

const entityManager = new YUKA.EntityManager();
entityManager.add(vehicle);

const loader = new GLTFLoader();
loader.load('./assets/SUV.glb', function(glb) {
    const model = glb.scene;
    //model.scale.set(0.5, 0.5, 0.5);
    scene.add(model);
    model.matrixAutoUpdate = false;
    vehicle.scale = new YUKA.Vector3(0.5, 0.5, 0.5);
    vehicle.setRenderComponent(model, sync);
});

// const vehicleGeometry = new THREE.ConeBufferGeometry(0.1, 0.5, 8);
// vehicleGeometry.rotateX(Math.PI * 0.5);
// const vehicleMaterial = new THREE.MeshNormalMaterial();
// const vehicleMesh = new THREE.Mesh(vehicleGeometry, vehicleMaterial);
// vehicleMesh.matrixAutoUpdate = false;
// scene.add(vehicleMesh);

const position = [];
for(let i = 0; i < path._waypoints.length; i++) {
    const waypoint = path._waypoints[i];
    position.push(waypoint.x, waypoint.y, waypoint.z);
}

const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));

const lines = new THREE.LineLoop(lineGeometry, lineMaterial);
scene.add(lines);

const time = new YUKA.Time();

function animate() {
    const delta = time.update().getDelta();
    entityManager.update(delta);
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});