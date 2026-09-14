// ============================================================
// Base de test — stockage en localStorage (simple, suffisant
// pour commencer). Si tu veux passer à IndexedDB plus tard
// pour plus de volume/robustesse, la logique de data ci-dessous
// est isolée exprès pour être facile à remplacer.
// ============================================================

const DB_KEY = "repas-app-data";

function loadData() {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) return JSON.parse(raw);
  return {
    plats: [],   // { id, nom, photo }
    items: [],   // { id, nom, categorie, photo }
    liaisons: [] // { id, aId, bId }  -> relie deux items OU deux plats entre eux
  };
}

function saveData(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

let data = loadData();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readPhoto(fileInput) {
  const file = fileInput.files[0];
  if (!file) return Promise.resolve("");

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Navigation entre les vues
// ============================================================

const views = {
  plats: document.getElementById("view-plats"),
  items: document.getElementById("view-items"),
  course: document.getElementById("view-course"),
  detail: document.getElementById("view-detail"),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove("active"));
  views[name].classList.add("active");

  document.getElementById("btn-ajouter").classList.toggle("visible", name === "plats" || name === "items");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

document.getElementById("btn-retour").addEventListener("click", () => {
  showView(currentDetailType === "plat" ? "plats" : "items");
});

// ============================================================
// Rendu des listes
// ============================================================

function renderPlats() {
  const ul = document.getElementById("liste-plats");
  ul.innerHTML = "";
  data.plats.forEach(plat => {
    const li = document.createElement("li");
    if (plat.photo) li.style.setProperty("--card-image", `url("${plat.photo}")`);
    li.innerHTML = `<span class="card-title">${plat.nom}</span><button class="btn-suppr" data-id="${plat.id}" aria-label="Supprimer ${plat.nom}">✕</button>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-suppr")) return;
      openDetail("plat", plat.id);
    });
    li.querySelector(".btn-suppr").addEventListener("click", () => {
      data.plats = data.plats.filter(p => p.id !== plat.id);
      data.liaisons = data.liaisons.filter(l => l.aId !== plat.id && l.bId !== plat.id);
      saveData(data);
      renderPlats();
    });
    ul.appendChild(li);
  });
}

function renderItems() {
  const ul = document.getElementById("liste-items");
  ul.innerHTML = "";
  data.items.forEach(item => {
    const li = document.createElement("li");
    if (item.photo) li.style.setProperty("--card-image", `url("${item.photo}")`);
    li.innerHTML = `<span class="card-title">${item.nom}</span><span class="badge">${item.categorie}</span><button class="btn-suppr" data-id="${item.id}" aria-label="Supprimer ${item.nom}">✕</button>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-suppr")) return;
      openDetail("item", item.id);
    });
    li.querySelector(".btn-suppr").addEventListener("click", () => {
      data.items = data.items.filter(i => i.id !== item.id);
      data.liaisons = data.liaisons.filter(l => l.aId !== item.id && l.bId !== item.id);
      saveData(data);
      renderItems();
    });
    ul.appendChild(li);
  });
}

// ============================================================
// Fenêtre d'ajout
// ============================================================

let currentAddType = "plat";
const dialogAjout = document.getElementById("dialog-ajout");
const formAjout = document.getElementById("form-ajout");
const nomAjoutInput = document.getElementById("input-ajout-nom");
const categorieAjoutInput = document.getElementById("input-ajout-categorie");
const photoAjoutInput = document.getElementById("input-ajout-photo");

document.getElementById("btn-ajouter").addEventListener("click", () => {
  currentAddType = document.getElementById("view-items").classList.contains("active") ? "item" : "plat";
  const isItem = currentAddType === "item";
  document.getElementById("dialog-ajout-titre").textContent = isItem ? "Ajouter un aliment" : "Ajouter un plat";
  nomAjoutInput.placeholder = isItem ? "Nom de l'aliment (ex: Pâtes)" : "Nom du plat (ex: Poulet riz)";
  categorieAjoutInput.hidden = !isItem;
  dialogAjout.showModal();
  nomAjoutInput.focus();
});

document.getElementById("btn-fermer-dialog").addEventListener("click", () => {
  dialogAjout.close();
});

formAjout.addEventListener("submit", async (e) => {
  e.preventDefault();
  const photo = await readPhoto(photoAjoutInput);
  if (currentAddType === "plat") {
    data.plats.push({ id: uid(), nom: nomAjoutInput.value.trim(), photo });
    renderPlats();
  } else {
    data.items.push({ id: uid(), nom: nomAjoutInput.value.trim(), categorie: categorieAjoutInput.value, photo });
    renderItems();
  }
  saveData(data);
  formAjout.reset();
  dialogAjout.close();
});

// ============================================================
// Vue détail : voir un plat/aliment + gérer ses liaisons
// ============================================================

let currentDetailType = null;
let currentDetailId = null;

function openDetail(type, id) {
  currentDetailType = type;
  currentDetailId = id;

  const collection = type === "plat" ? data.plats : data.items;
  const elem = collection.find(x => x.id === id);

  document.getElementById("detail-titre").textContent = elem.nom;
  renderDetailContenu();
  showView("detail");
}

function renderDetailContenu() {
  const collection = currentDetailType === "plat" ? data.plats : data.items;
  const autresMemeType = collection.filter(x => x.id !== currentDetailId);

  const liaisonsExistantes = data.liaisons.filter(
    l => l.aId === currentDetailId || l.bId === currentDetailId
  );

  const html = `
    <div class="liaisons">
      <strong>Éléments liés :</strong>
      <ul class="liste">
        ${liaisonsExistantes.map(l => {
          const autreId = l.aId === currentDetailId ? l.bId : l.aId;
          const autre = collection.find(x => x.id === autreId);
          if (!autre) return "";
          return `<li>${autre.nom} <button class="btn-suppr" data-liaison="${l.id}">✕</button></li>`;
        }).join("")}
      </ul>

      <div class="liaison-form">
        <select id="select-liaison">
          ${autresMemeType.map(x => `<option value="${x.id}">${x.nom}</option>`).join("")}
        </select>
        <button id="btn-ajouter-liaison">Lier</button>
      </div>
    </div>
  `;

  document.getElementById("detail-contenu").innerHTML = html;

  document.querySelectorAll("[data-liaison]").forEach(btn => {
    btn.addEventListener("click", () => {
      data.liaisons = data.liaisons.filter(l => l.id !== btn.dataset.liaison);
      saveData(data);
      renderDetailContenu();
    });
  });

  const btnAjouter = document.getElementById("btn-ajouter-liaison");
  if (btnAjouter) {
    btnAjouter.addEventListener("click", () => {
      const autreId = document.getElementById("select-liaison").value;
      if (!autreId) return;
      data.liaisons.push({ id: uid(), aId: currentDetailId, bId: autreId });
      saveData(data);
      renderDetailContenu();
    });
  }
}

// ============================================================
// Enregistrement du service worker (fonctionnement hors-ligne)
// ============================================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(err => {
      console.log("Erreur service worker :", err);
    });
  });
}

// ============================================================
// Rendu initial
// ============================================================

renderPlats();
renderItems();
