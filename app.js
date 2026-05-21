const THREE_URLS = [
    "three.min.js",
    "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"
];

function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Impossible de charger ${url}`));
        document.head.appendChild(script);
    });
}

async function loadThree() {
    if (window.THREE) return;

    let lastError;
    for (const url of THREE_URLS) {
        try {
            await loadScript(url);
            if (window.THREE) return;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Three.js est introuvable.");
}

function vectorDistance(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function averageVector(points) {
    const sum = points.reduce(
        (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
        [0, 0, 0]
    );
    return sum.map(value => value / points.length);
}

function formatPoint(point) {
    return point.map(value => value.toFixed(1)).join(", ");
}

function createRandomPoints(count) {
    const centers = [
        [-28, -18, 16],
        [26, 22, -14],
        [-14, 30, 28],
        [30, -28, 22]
    ];

    return Array.from({ length: count }, (_, index) => {
        const center = centers[index % centers.length];
        return center.map(value => value + (Math.random() - 0.5) * 24);
    });
}

function setStatus(message) {
    document.getElementById("status").textContent = message;
}

function renderResults({ clusters, centroids, iteration, inertia }) {
    const results = document.getElementById("results");

    results.innerHTML = centroids.map((centroid, index) => {
        const count = clusters[index].length;
        return `
            <li>
                <span class="dot" style="background:${CLUSTER_CSS_COLORS[index]}"></span>
                Cluster ${index + 1}: ${count} points
                <small>Centre: ${formatPoint(centroid)}</small>
            </li>
        `;
    }).join("");

    document.getElementById("summary").textContent =
        `Iteration ${iteration} - inertie ${inertia.toFixed(2)}`;
}

const CLUSTER_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x7b2cbf, 0x06d6a0, 0xf72585];
const CLUSTER_CSS_COLORS = ["#e63946", "#2a9d8f", "#f4a261", "#7b2cbf", "#06d6a0", "#f72585"];

loadThree()
    .then(() => {
        const canvasHost = document.getElementById("canvasHost");
        const startBtn = document.getElementById("startBtn");
        const resetBtn = document.getElementById("resetBtn");
        const kInput = document.getElementById("clusterCount");

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x101418);

        const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(68, 64, 112);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        canvasHost.appendChild(renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, 1.1);
        light.position.set(1, 1, 1).normalize();
        scene.add(light);
        scene.add(new THREE.AmbientLight(0xffffff, 0.45));

        const axes = new THREE.AxesHelper(48);
        scene.add(axes);

        const points = createRandomPoints(520);
        const pointObjects = [];
        let centroidMeshes = [];
        let currentRun = 0;

        points.forEach(([x, y, z]) => {
            const geometry = new THREE.SphereGeometry(0.9, 10, 10);
            const material = new THREE.MeshLambertMaterial({ color: 0xd8dee9 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            scene.add(mesh);
            pointObjects.push(mesh);
        });

        function clearCentroids() {
            centroidMeshes.forEach(mesh => scene.remove(mesh));
            centroidMeshes = [];
        }

        function resetVisualization() {
            currentRun += 1;
            clearCentroids();
            pointObjects.forEach(mesh => mesh.material.color.setHex(0xd8dee9));
            document.getElementById("results").innerHTML = "";
            document.getElementById("summary").textContent = "Pret a calculer";
            setStatus("Choisis k puis lance le clustering.");
            startBtn.disabled = false;
        }

        function initializeCentroids(k) {
            const chosen = new Set();
            const centroids = [];

            while (centroids.length < k) {
                const index = Math.floor(Math.random() * points.length);
                if (!chosen.has(index)) {
                    chosen.add(index);
                    centroids.push([...points[index]]);
                }
            }

            clearCentroids();
            centroids.forEach((centroid, index) => {
                const geometry = new THREE.SphereGeometry(3.8, 18, 18);
                const material = new THREE.MeshBasicMaterial({
                    color: CLUSTER_COLORS[index],
                    wireframe: true
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(centroid[0], centroid[1], centroid[2]);
                scene.add(mesh);
                centroidMeshes.push(mesh);
            });

            return centroids;
        }

        function assignClusters(centroids, k) {
            const clusters = Array.from({ length: k }, () => []);
            let inertia = 0;

            points.forEach((point, pointIndex) => {
                let closest = 0;
                let minDistance = Infinity;

                centroids.forEach((centroid, centroidIndex) => {
                    const distance = vectorDistance(point, centroid);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closest = centroidIndex;
                    }
                });

                clusters[closest].push(point);
                inertia += minDistance * minDistance;
                pointObjects[pointIndex].material.color.setHex(CLUSTER_COLORS[closest]);
            });

            return { clusters, inertia };
        }

        function recomputeCentroids(clusters, centroids) {
            return clusters.map((cluster, index) => {
                if (!cluster.length) return centroids[index];
                const nextCentroid = averageVector(cluster);
                centroidMeshes[index].position.set(nextCentroid[0], nextCentroid[1], nextCentroid[2]);
                return nextCentroid;
            });
        }

        function runKMeansVisual() {
            const runId = currentRun + 1;
            currentRun = runId;

            const k = Math.max(2, Math.min(Number(kInput.value) || 4, CLUSTER_COLORS.length));
            const maxIterations = 14;
            let centroids = initializeCentroids(k);
            let iteration = 0;

            startBtn.disabled = true;
            setStatus("Calcul K-Means en cours...");

            function nextStep() {
                if (runId !== currentRun) return;

                const { clusters, inertia } = assignClusters(centroids, k);
                centroids = recomputeCentroids(clusters, centroids);
                iteration += 1;

                renderResults({ clusters, centroids, iteration, inertia });

                if (iteration >= maxIterations) {
                    setStatus(`Clustering termine en ${iteration} iterations.`);
                    startBtn.disabled = false;
                    return;
                }

                setStatus(`Calcul K-Means: iteration ${iteration}/${maxIterations}`);
                window.setTimeout(nextStep, 320);
            }

            nextStep();
        }

        startBtn.addEventListener("click", runKMeansVisual);
        resetBtn.addEventListener("click", resetVisualization);
        kInput.addEventListener("input", () => {
            const value = Math.max(2, Math.min(Number(kInput.value) || 4, CLUSTER_COLORS.length));
            kInput.value = value;
        });

        function animate() {
            requestAnimationFrame(animate);
            scene.rotation.y += 0.0025;
            renderer.render(scene, camera);
        }

        animate();

        window.addEventListener("resize", () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        resetVisualization();
    })
    .catch(error => {
        console.error(error);
        setStatus("Erreur: Three.js ne peut pas etre charge. Lance avec Docker ou verifie la connexion.");
    });
