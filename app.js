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
    plats: [],   // { id, nom }
    items: [],   // { id, nom, categorie }
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
    li.innerHTML = `<span>${plat.nom}</span> <button class="btn-suppr" data-id="${plat.id}">✕</button>`;
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
    li.innerHTML = `<span>${item.nom}</span> <span class="badge">${item.categorie}</span> <button class="btn-suppr" data-id="${item.id}">✕</button>`;
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
// Formulaires d'ajout
// ============================================================

document.getElementById("form-plat").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("input-plat-nom");
  data.plats.push({ id: uid(), nom: input.value.trim() });
  saveData(data);
  input.value = "";
  renderPlats();
});

document.getElementById("form-item").addEventListener("submit", (e) => {
  e.preventDefault();
  const nomInput = document.getElementById("input-item-nom");
  const catInput = document.getElementById("input-item-categorie");
  data.items.push({ id: uid(), nom: nomInput.value.trim(), categorie: catInput.value });
  saveData(data);
  nomInput.value = "";
  renderItems();
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
