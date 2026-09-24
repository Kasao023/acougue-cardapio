// ============================================
// CASA DE CARNES - CARDÁPIO ONLINE
// Com sistema de carrinho e conversão de peso
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyAgUXojOAljeRudGNRF9rcvAJ4CNJSVF-s",
  authDomain: "fir-aluguel2.firebaseapp.com",
  databaseURL: "https://fir-aluguel2.firebaseio.com",
  projectId: "fir-aluguel2",
  storageBucket: "fir-aluguel2.appspot.com",
  messagingSenderId: "1082687810478",
  appId: "1:1082687810478:web:3af608b7264b5f95eab63f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const WHATSAPP = "5515998183052";
let categorias = [];
let produtos = [];
let carrinho = [];
let produtoAtual = null; // Produto sendo adicionado no modal

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
function carregarDados() {
    console.log('🔄 Carregando dados do Firebase...');

    db.ref('Category').once('value')
        .then(snapCat => {
            categorias = [];
            snapCat.forEach(c => {
                categorias.push({
                    id: c.key,
                    nome: c.val().name || 'Sem nome',
                    imagem: c.val().image || ''
                });
            });

            categorias.sort((a, b) => a.id.localeCompare(b.id));
            console.log('✅ Categorias:', categorias.length);
            renderizarNavCategorias();

            return db.ref('Foods').once('value');
        })
        .then(snapProd => {
            produtos = [];
            snapProd.forEach(p => {
                const val = p.val();
                if (val.name && val.menuId) {
                    const parsed = parsePreco(val.price || '');
                    produtos.push({
                        id: p.key,
                        nome: val.name,
                        precoOriginal: val.price || '',
                        precoNumerico: parsed.valor,
                        unidade: parsed.unidade,
                        imagem: val.image || '',
                        descricao: val.description || '',
                        menuId: val.menuId
                    });
                }
            });

            console.log('✅ Produtos:', produtos.length);
            renderizarProdutos();
            document.getElementById('loading').style.display = 'none';

            // Carregar carrinho salvo
            carregarCarrinhoSalvo();
        })
        .catch(err => {
            console.error('❌ Erro:', err);
            document.getElementById('loading').innerHTML =
                '<div class="alert alert-danger">Erro ao carregar produtos. Verifique a conexão.</div>';
        });
}

// ============================================
// CONVERSOR DE PREÇO
// "29,99 kg" → { valor: 29.99, unidade: 'kg' }
// "3,99 un"  → { valor: 3.99,  unidade: 'un' }
// "69,99"    → { valor: 69.99, unidade: 'kg' } (padrão)
// ============================================
function parsePreco(precoStr) {
    if (!precoStr || precoStr.trim() === '') {
        return { valor: 0, unidade: 'kg' };
    }

    let str = String(precoStr).replace(/\$/g, '').trim();

    // Detecta unidade
    let unidade = 'kg';
    if (/\bun\b/i.test(str) || /unidade/i.test(str)) {
        unidade = 'un';
    } else if (/\bkg\b/i.test(str)) {
        unidade = 'kg';
    }

    // Extrai número (aceita vírgula ou ponto)
    let nums = str.replace(/[^\d,.]/g, '').trim();
    nums = nums.replace(',', '.');
    let valor = parseFloat(nums);
    if (isNaN(valor)) valor = 0;

    return { valor, unidade };
}

// ============================================
// NAVEGAÇÃO DE CATEGORIAS
// ============================================
function renderizarNavCategorias() {
    const container = document.getElementById('categorias-scroll');
    if (!container) return;

    let html = '<button class="categoria-chip ativo" onclick="scrollParaCategoria(\'todos\', this)">Todos</button>';

    categorias.forEach(cat => {
        html += `
            <button class="categoria-chip" onclick="scrollParaCategoria('${cat.id}', this)">
                ${cat.nome}
            </button>
        `;
    });

    container.innerHTML = html;
}

function scrollParaCategoria(id, btn) {
    document.querySelectorAll('.categoria-chip').forEach(c => c.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');

    if (id === 'todos') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    const secao = document.getElementById('secao-' + id);
    if (secao) secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// RENDERIZAR PRODUTOS
// ============================================
function renderizarProdutos(filtro = '') {
    const container = document.getElementById('produtos-container');
    if (!container) return;

    const termo = filtro.toLowerCase().trim();
    let html = '';
    let total = 0;

    categorias.forEach(cat => {
        const produtosCat = produtos.filter(p => {
            const matchCat = p.menuId === cat.id;
            const matchBusca = termo === '' || p.nome.toLowerCase().includes(termo);
            return matchCat && matchBusca;
        });

        if (produtosCat.length === 0) return;

        total += produtosCat.length;

        html += `
            <section class="categoria-secao" id="secao-${cat.id}">
                <h2 class="categoria-titulo">${cat.nome}</h2>
                <div class="row g-3">
        `;

        produtosCat.forEach(prod => {
            const precoExibir = prod.precoNumerico > 0
                ? `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}${prod.unidade === 'kg' ? ' /kg' : ' /un'}`
                : 'Consulte';
            
            const podeAdicionar = prod.precoNumerico > 0;

            html += `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="produto-card">
                        <img src="${prod.imagem}" alt="${prod.nome}" class="produto-imagem" loading="lazy"
                             onerror="this.src='https://placehold.co/300x200/eeeeee/999999?text=Sem+Foto'">
                        <div class="produto-info">
                            <h3 class="produto-nome">${prod.nome}</h3>
                            <div class="produto-preco">${precoExibir}</div>
                            ${podeAdicionar 
                                ? `<button class="btn-pedir" onclick="abrirModalPeso('${prod.id}')">
                                    <i class="bi bi-cart-plus"></i> Adicionar
                                   </button>`
                                : `<button class="btn-pedir" style="opacity:0.5;cursor:not-allowed;" disabled>
                                    <i class="bi bi-x-circle"></i> Indisponível
                                   </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div></section>`;
    });

    if (total === 0) {
        html = `
            <div class="sem-produtos">
                <i class="bi bi-search"></i>
                <h4>Nenhum produto encontrado</h4>
                <p>Tente buscar por outro nome</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

function filtrarProdutos() {
    const termo = document.getElementById('busca').value;
    renderizarProdutos(termo);
}

// ============================================
// MODAL DE PESO/QUANTIDADE
// ============================================
function abrirModalPeso(produtoId) {
    const prod = produtos.find(p => p.id === produtoId);
    if (!prod) return;

    produtoAtual = prod;

    // Preenche dados do modal
    document.getElementById('modal-produto-imagem').src = prod.imagem;
    document.getElementById('modal-produto-nome').textContent = prod.nome;
    document.getElementById('modal-produto-preco').textContent = 
        `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}${prod.unidade === 'kg' ? ' /kg' : ' /un'}`;

    // Se for unidade, esconde o seletor de g/kg
    const wrapperUnidade = document.getElementById('modal-unidade-wrapper');
    const labelQtd = document.getElementById('modal-qtd-label');

    if (prod.unidade === 'un') {
        wrapperUnidade.style.display = 'none';
        labelQtd.textContent = 'Quantidade (unidades)';
        document.getElementById('modal-quantidade').step = '1';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 2';
    } else {
        wrapperUnidade.style.display = 'block';
        labelQtd.textContent = 'Quantidade (g)';
        document.getElementById('modal-quantidade').step = '1';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 500';
        document.getElementById('unidade-g').checked = true;
    }

    // Limpa quantidade
    document.getElementById('modal-quantidade').value = '';
    document.getElementById('modal-subtotal').textContent = 'R$ 0,00';

    // Abre modal
    new bootstrap.Modal(document.getElementById('modalPeso')).show();
}

function setQtd(valor) {
    const unidade = document.querySelector('input[name="unidade"]:checked')?.value || 'g';
    const input = document.getElementById('modal-quantidade');

    if (produtoAtual && produtoAtual.unidade === 'un') {
        input.value = valor / 1000;
    } else if (unidade === 'g') {
        input.value = valor;
    } else {
        input.value = valor / 1000;
    }

    atualizarCalculo();
}

function atualizarCalculo() {
    if (!produtoAtual) return;

    const input = document.getElementById('modal-quantidade');
    const labelQtd = document.getElementById('modal-qtd-label');
    const unidade = produtoAtual.unidade === 'un' 
        ? 'un' 
        : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    // Atualiza label
    if (produtoAtual.unidade === 'un') {
        labelQtd.textContent = 'Quantidade (unidades)';
    } else {
        labelQtd.textContent = unidade === 'g' ? 'Quantidade (g)' : 'Quantidade (kg)';
    }

    const qtdDigitada = parseFloat(input.value) || 0;
    let quantidadeKg = 0;

    if (produtoAtual.unidade === 'un') {
        quantidadeKg = qtdDigitada; // só usa direto (não é peso)
    } else if (unidade === 'g') {
        quantidadeKg = qtdDigitada / 1000;
    } else {
        quantidadeKg = qtdDigitada;
    }

    const subtotal = produtoAtual.precoNumerico * quantidadeKg;
    document.getElementById('modal-subtotal').textContent = 
        `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

function confirmarAdicao() {
    if (!produtoAtual) return;

    const input = document.getElementById('modal-quantidade');
    const qtdDigitada = parseFloat(input.value) || 0;

    if (qtdDigitada <= 0) {
        alert('Informe uma quantidade válida.');
        return;
    }

    const unidade = produtoAtual.unidade === 'un' 
        ? 'un' 
        : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    let quantidadeKg = 0;
    let quantidadeExibir = '';

    if (produtoAtual.unidade === 'un') {
        quantidadeKg = qtdDigitada;
        quantidadeExibir = `${qtdDigitada} un`;
    } else if (unidade === 'g') {
        quantidadeKg = qtdDigitada / 1000;
        quantidadeExibir = `${qtdDigitada}g`;
    } else {
        quantidadeKg = qtdDigitada;
        quantidadeExibir = `${qtdDigitada}kg`;
    }

    const subtotal = produtoAtual.precoNumerico * quantidadeKg;

    // Adiciona ao carrinho
    const item = {
        id: produtoAtual.id,
        nome: produtoAtual.nome,
        imagem: produtoAtual.imagem,
        precoKg: produtoAtual.precoNumerico,
        unidade: produtoAtual.unidade,
        quantidadeKg: quantidadeKg,
        quantidadeExibir: quantidadeExibir,
        subtotal: subtotal
    };

    carrinho.push(item);
    salvarCarrinho();
    atualizarCarrinho();

    // Fecha modal
    bootstrap.Modal.getInstance(document.getElementById('modalPeso')).hide();

    // Toast
    mostrarToast(`${produtoAtual.nome} adicionado!`);
}

// ============================================
// CARRINHO
// ============================================
function atualizarCarrinho() {
    const badge = document.getElementById('badge-carrinho');
    const totalItens = carrinho.length;

    if (totalItens > 0) {
        badge.textContent = totalItens;
        badge.classList.add('visivel');
    } else {
        badge.classList.remove('visivel');
    }

    const body = document.getElementById('carrinho-body');
    const footer = document.getElementById('carrinho-footer');

    if (carrinho.length === 0) {
        body.innerHTML = `
            <div class="carrinho-vazio">
                <i class="bi bi-cart-x"></i>
                <h5>Seu carrinho está vazio</h5>
                <p class="small">Adicione produtos para começar</p>
            </div>
        `;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';

    let html = '';
    let total = 0;

    carrinho.forEach((item, index) => {
        total += item.subtotal;

        html += `
            <div class="item-carrinho">
                <img src="${item.imagem}" alt="${item.nome}"
                     onerror="this.src='https://placehold.co/100x100/eeeeee/999999?text=?'">
                <div class="item-carrinho-info">
                    <h5>${item.nome}</h5>
                    <div class="item-qtd">${item.quantidadeExibir}</div>
                    <div class="item-preco">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                </div>
                <button class="btn-remover-item" onclick="removerItem(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
    });

    body.innerHTML = html;
    document.getElementById('carrinho-total').textContent = 
        `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function removerItem(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
}

function abrirCarrinho() {
    document.getElementById('carrinho-lateral').classList.add('ativo');
    document.getElementById('carrinho-overlay').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}

function fecharCarrinho() {
    document.getElementById('carrinho-lateral').classList.remove('ativo');
    document.getElementById('carrinho-overlay').classList.remove('ativo');
    document.body.style.overflow = '';
}

// ============================================
// PERSISTÊNCIA DO CARRINHO
// ============================================
function salvarCarrinho() {
    try {
        localStorage.setItem('carrinho_acougue', JSON.stringify(carrinho));
    } catch (e) {
        console.error('Erro ao salvar carrinho:', e);
    }
}

function carregarCarrinhoSalvo() {
    try {
        const salvo = localStorage.getItem('carrinho_acougue');
        if (salvo) {
            carrinho = JSON.parse(salvo);
            atualizarCarrinho();
        }
    } catch (e) {
        carrinho = [];
    }
}

// ============================================
// FINALIZAR PEDIDO
// ============================================
function finalizarPedido() {
    if (carrinho.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }

    let total = 0;
    let mensagem = `*🥩 NOVO PEDIDO - CASA DE CARNES*%0A%0A`;
    mensagem += `━━━━━━━━━━━━━━━━━━%0A`;
    mensagem += `*🛒 ITENS DO PEDIDO*%0A`;

    carrinho.forEach(item => {
        total += item.subtotal;
        const precoKgFmt = item.precoKg.toFixed(2).replace('.', ',');
        const subtotalFmt = item.subtotal.toFixed(2).replace('.', ',');

        mensagem += `%0A▪️ *${item.nome}*%0A`;
        mensagem += `   Qtd: ${item.quantidadeExibir}%0A`;
        mensagem += `   Preço: R$ ${precoKgFmt}${item.unidade === 'kg' ? '/kg' : '/un'}%0A`;
        mensagem += `   Subtotal: R$ ${subtotalFmt}%0A`;
    });

    mensagem += `%0A━━━━━━━━━━━━━━━━━━%0A`;
    mensagem += `*💰 TOTAL: R$ ${total.toFixed(2).replace('.', ',')}*%0A`;
    mensagem += `━━━━━━━━━━━━━━━━━━%0A%0A`;
    mensagem += `📍 Por favor, informe seu endereço de entrega:`;

    const url = `https://wa.me/${WHATSAPP}?text=${mensagem}`;
    window.open(url, '_blank');
}

// ============================================
// TOAST
// ============================================
function mostrarToast(texto) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        background: #27ae60;
        color: #fff;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        font-weight: 600;
        transform: translateX(400px);
        transition: transform 0.35s ease;
        max-width: 320px;
    `;
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${texto}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.style.transform = 'translateX(0)', 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => toast.remove(), 350);
    }, 2500);
}

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', carregarDados);