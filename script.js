// ============================================
// CASA DE CARNE H&S - CARDÁPIO ONLINE
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

// ⚠️ CONFIGURAÇÕES DO CLIENTE (ALTERE AQUI ANTES DE SUBIR)
const WHATSAPP = "5515999999999"; // Coloque o número com DDD e o 55 na frente
const CHAVE_PIX = "00.000.000/0000-00"; // Coloque o CNPJ, CPF, e-mail ou telefone

let categorias = [];
let produtos = [];
let carrinho = [];
let produtoAtual = null;

// ============================================
// NAVEGAÇÃO DE TELAS
// ============================================
window.entrarNaLoja = function() {
    const telaHome = document.getElementById('tela-home');
    const appPrincipal = document.getElementById('app-principal');
    telaHome.style.opacity = '0';
    setTimeout(() => {
        telaHome.style.display = 'none';
        appPrincipal.classList.remove('app-escondido');
        window.scrollTo(0, 0);
    }, 300);
}

window.voltarParaHome = function() {
    const telaHome = document.getElementById('tela-home');
    const appPrincipal = document.getElementById('app-principal');
    appPrincipal.classList.add('app-escondido');
    telaHome.style.display = 'flex';
    setTimeout(() => { telaHome.style.opacity = '1'; }, 50);
}

// ============================================
// MODAL SOBRE NÓS
// ============================================
window.abrirSobreNos = function() {
    document.getElementById('modalSobre').classList.add('show');
}
window.fecharSobreNos = function() {
    document.getElementById('modalSobre').classList.remove('show');
}
window.mudarAba = function(abaId, btn) {
    document.querySelectorAll('.aba-btn').forEach(b => b.classList.remove('ativo'));
    btn.classList.add('ativo');
    document.querySelectorAll('.aba-conteudo').forEach(c => c.classList.remove('ativo'));
    document.getElementById('aba-conteudo-' + abaId).classList.add('ativo');
}

// ============================================
// CARREGAR DADOS DO FIREBASE
// ============================================
function carregarDados() {
    db.ref('Category').once('value')
        .then(snapCat => {
            categorias = [];
            snapCat.forEach(c => {
                categorias.push({ id: c.key, nome: c.val().name || 'Sem nome' });
            });
            categorias.sort((a, b) => a.id.localeCompare(b.id));
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
                        precoNumerico: parsed.valor,
                        unidade: parsed.unidade,
                        imagem: val.image || '',
                        menuId: val.menuId,
                        disponivel: val.disponivel !== false
                    });
                }
            });
            renderizarProdutos();
            document.getElementById('loading').style.display = 'none';
            carregarCarrinhoSalvo();
        })
        .catch(err => {
            console.error('Erro:', err);
            document.getElementById('loading').innerHTML = '<div class="alert alert-danger">Erro ao carregar produtos.</div>';
        });
}

function parsePreco(precoStr) {
    if (!precoStr || precoStr.trim() === '') return { valor: 0, unidade: 'kg' };
    let str = String(precoStr).replace(/\$/g, '').trim();
    let unidade = 'kg';
    if (/\bun\b/i.test(str) || /unidade/i.test(str)) unidade = 'un';
    else if (/\bkg\b/i.test(str)) unidade = 'kg';
    let nums = str.replace(/[^\d,.]/g, '').trim().replace(',', '.');
    let valor = parseFloat(nums);
    if (isNaN(valor)) valor = 0;
    return { valor, unidade };
}

// ============================================
// RENDERIZAR PRODUTOS
// ============================================
function renderizarNavCategorias() {
    const container = document.getElementById('categorias-scroll');
    if (!container) return;
    let html = '<button class="categoria-chip ativo" onclick="scrollParaCategoria(\'todos\', this)">Todos</button>';
    categorias.forEach(cat => {
        html += `<button class="categoria-chip" onclick="scrollParaCategoria('${cat.id}', this)">${cat.nome}</button>`;
    });
    container.innerHTML = html;
}

function scrollParaCategoria(id, btn) {
    document.querySelectorAll('.categoria-chip').forEach(c => c.classList.remove('ativo'));
    if (btn) btn.classList.add('ativo');
    if (id === 'todos') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const secao = document.getElementById('secao-' + id);
    if (secao) secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

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
            const estaDisponivel = p.disponivel !== false;
            return matchCat && matchBusca && estaDisponivel;
        });
        if (produtosCat.length === 0) return;
        total += produtosCat.length;

        html += `<section class="categoria-secao" id="secao-${cat.id}"><h2 class="categoria-titulo">${cat.nome}</h2><div class="lista-produtos">`;

        produtosCat.forEach(prod => {
            const precoExibir = prod.precoNumerico > 0
                ? `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')} <small>${prod.unidade === 'kg' ? '/kg' : '/un'}</small>`
                : 'Consulte';
            const podeAdicionar = prod.precoNumerico > 0;

            html += `
                <div class="produto-card">
                    <img src="${prod.imagem}" alt="${prod.nome}" class="produto-imagem" loading="lazy" onerror="this.src='https://placehold.co/150x150/eeeeee/999999?text=Sem+Foto'">
                    <div class="produto-info">
                        <h3 class="produto-nome">${prod.nome}</h3>
                        <div class="produto-preco">${precoExibir}</div>
                    </div>
                    ${podeAdicionar ? `<button class="btn-adicionar" onclick="window.abrirModalPeso('${prod.id}')"><i class="bi bi-plus-lg"></i></button>` : `<button class="btn-adicionar" style="background:#ccc;" disabled><i class="bi bi-x"></i></button>`}
                </div>
            `;
        });
        html += `</div></section>`;
    });

    if (total === 0) {
        html = `<div class="sem-produtos"><i class="bi bi-search" style="font-size:3rem;color:#ddd;display:block;margin-bottom:10px;"></i><h4>Nenhum produto encontrado</h4></div>`;
    }
    container.innerHTML = html;
}

window.filtrarProdutos = function() {
    renderizarProdutos(document.getElementById('busca').value);
}

// ============================================
// MODAL DE ADIÇÃO
// ============================================
window.abrirModalPeso = function(produtoId) {
    const prod = produtos.find(p => p.id === produtoId);
    if (!prod) return;
    produtoAtual = prod;

    document.getElementById('modal-produto-imagem').src = prod.imagem;
    document.getElementById('modal-produto-nome').textContent = prod.nome;
    document.getElementById('modal-produto-preco').textContent = `R$ ${prod.precoNumerico.toFixed(2).replace('.', ',')}${prod.unidade === 'kg' ? ' /kg' : ' /un'}`;

    const wrapperUnidade = document.getElementById('modal-unidade-wrapper');
    const labelQtd = document.getElementById('modal-qtd-label');
    const opcoesCorte = document.getElementById('opcoes-corte-wrapper');

    if (prod.unidade === 'un') {
        wrapperUnidade.style.display = 'none';
        opcoesCorte.style.display = 'none';
        labelQtd.textContent = 'Quantidade (unidades)';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 2';
    } else {
        wrapperUnidade.style.display = 'block';
        opcoesCorte.style.display = 'block';
        labelQtd.textContent = 'Quantidade (g)';
        document.getElementById('modal-quantidade').placeholder = 'Ex: 500';
        document.getElementById('unidade-g').checked = true;
    }

    document.getElementById('modal-quantidade').value = '';
    document.getElementById('modal-observacao').value = '';
    document.getElementById('corte-inteiro').checked = true;
    document.getElementById('modal-subtotal').textContent = 'R$ 0,00';

    new bootstrap.Modal(document.getElementById('modalPeso')).show();
}

window.setQtd = function(valor) {
    const unidade = document.querySelector('input[name="unidade"]:checked')?.value || 'g';
    const input = document.getElementById('modal-quantidade');
    if (produtoAtual.unidade === 'un') input.value = valor / 1000;
    else if (unidade === 'g') input.value = valor;
    else input.value = valor / 1000;
    atualizarCalculo();
}

window.atualizarCalculo = function() {
    if (!produtoAtual) return;
    const input = document.getElementById('modal-quantidade');
    const labelQtd = document.getElementById('modal-qtd-label');
    const unidade = produtoAtual.unidade === 'un' ? 'un' : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');

    if (produtoAtual.unidade !== 'un') {
        labelQtd.textContent = unidade === 'g' ? 'Quantidade (g)' : 'Quantidade (kg)';
    }

    const qtdDigitada = parseFloat(input.value) || 0;
    let quantidadeKg = produtoAtual.unidade === 'un' ? qtdDigitada : (unidade === 'g' ? qtdDigitada / 1000 : qtdDigitada);
    const subtotal = produtoAtual.precoNumerico * quantidadeKg;
    document.getElementById('modal-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
}

window.confirmarAdicao = function() {
    if (!produtoAtual) return;
    const input = document.getElementById('modal-quantidade');
    const qtdDigitada = parseFloat(input.value) || 0;

    if (qtdDigitada <= 0) {
        alert('Informe uma quantidade válida.');
        return;
    }

    const unidade = produtoAtual.unidade === 'un' ? 'un' : (document.querySelector('input[name="unidade"]:checked')?.value || 'g');
    let quantidadeKg = produtoAtual.unidade === 'un' ? qtdDigitada : (unidade === 'g' ? qtdDigitada / 1000 : qtdDigitada);
    let quantidadeExibir = produtoAtual.unidade === 'un' ? `${qtdDigitada} un` : (unidade === 'g' ? `${qtdDigitada}g` : `${qtdDigitada}kg`);
    const subtotal = produtoAtual.precoNumerico * quantidadeKg;

    let tipoCorte = '';
    if (produtoAtual.unidade === 'kg') {
        tipoCorte = document.querySelector('input[name="tipoCorte"]:checked')?.value || 'Inteiro';
    }
    const observacao = document.getElementById('modal-observacao').value.trim();

    const item = {
        id: produtoAtual.id,
        nome: produtoAtual.nome,
        imagem: produtoAtual.imagem,
        precoKg: produtoAtual.precoNumerico,
        unidade: produtoAtual.unidade,
        quantidadeKg: quantidadeKg,
        quantidadeExibir: quantidadeExibir,
        subtotal: subtotal,
        tipoCorte: tipoCorte,
        observacao: observacao
    };

    carrinho.push(item);
    salvarCarrinho();
    atualizarCarrinho();
    bootstrap.Modal.getInstance(document.getElementById('modalPeso')).hide();
    mostrarToast(`${produtoAtual.nome} adicionado!`);
}

// ============================================
// CARRINHO
// ============================================
function atualizarCarrinho() {
    const badge = document.getElementById('badge-carrinho');
    if (badge) {
        if (carrinho.length > 0) {
            badge.textContent = carrinho.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    const body = document.getElementById('carrinho-body');
    const footer = document.getElementById('carrinho-footer');

    if (carrinho.length === 0) {
        body.innerHTML = `<div class="carrinho-vazio"><i class="bi bi-cart-x"></i><h5>Seu carrinho está vazio</h5><p class="small">Adicione produtos para começar</p></div>`;
        footer.style.display = 'none';
        return;
    }

    footer.style.display = 'block';
    let html = '';
    let total = 0;

    carrinho.forEach((item, index) => {
        total += item.subtotal;
        
        let detalhesExtras = '';
        if (item.tipoCorte) detalhesExtras += `<div class="item-obs"><strong>Corte:</strong> ${item.tipoCorte}</div>`;
        if (item.observacao) detalhesExtras += `<div class="item-obs"><strong>Obs:</strong> ${item.observacao}</div>`;

        html += `
            <div class="item-carrinho">
                <img src="${item.imagem}" alt="${item.nome}" onerror="this.src='https://placehold.co/100x100/eeeeee/999999?text=?'">
                <div class="item-carrinho-info">
                    <h5>${item.nome}</h5>
                    <div class="item-qtd">${item.quantidadeExibir}</div>
                    ${detalhesExtras}
                    <div class="item-preco">R$ ${item.subtotal.toFixed(2).replace('.', ',')}</div>
                </div>
                <button class="btn-remover-item" onclick="window.removerItem(${index})"><i class="bi bi-trash"></i></button>
            </div>
        `;
    });

    body.innerHTML = html;
    document.getElementById('carrinho-total').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

window.removerItem = function(index) {
    carrinho.splice(index, 1);
    salvarCarrinho();
    atualizarCarrinho();
}

window.abrirCarrinho = function() {
    document.getElementById('carrinho-lateral').classList.add('ativo');
    document.getElementById('carrinho-overlay').classList.add('ativo');
    document.body.style.overflow = 'hidden';
}

window.fecharCarrinho = function() {
    document.getElementById('carrinho-lateral').classList.remove('ativo');
    document.getElementById('carrinho-overlay').classList.remove('ativo');
    document.body.style.overflow = '';
}

function salvarCarrinho() {
    try { localStorage.setItem('carrinho_hs', JSON.stringify(carrinho)); } catch (e) {}
}

function carregarCarrinhoSalvo() {
    try {
        const salvo = localStorage.getItem('carrinho_hs');
        if (salvo) {
            carrinho = JSON.parse(salvo);
            atualizarCarrinho();
        }
    } catch (e) { carrinho = []; }
}

// ============================================
// ABRIR MODAL DE ENDEREÇO (NOVO)
// ============================================
window.abrirModalEndereco = function() {
    if (carrinho.length === 0) {
        alert('Seu carrinho está vazio!');
        return;
    }
    // Fecha o carrinho lateral para não ficar por baixo
    window.fecharCarrinho();
    
    // Tenta recuperar dados salvos do cliente no navegador
    const dadosSalvos = JSON.parse(localStorage.getItem('cliente_hs') || '{}');
    if (dadosSalvos.nome) document.getElementById('cli-nome').value = dadosSalvos.nome;
    if (dadosSalvos.rua) document.getElementById('cli-rua').value = dadosSalvos.rua;
    if (dadosSalvos.numero) document.getElementById('cli-numero').value = dadosSalvos.numero;
    if (dadosSalvos.bairro) document.getElementById('cli-bairro').value = dadosSalvos.bairro;
    if (dadosSalvos.complemento) document.getElementById('cli-complemento').value = dadosSalvos.complemento;

    new bootstrap.Modal(document.getElementById('modalEndereco')).show();
}

// ============================================
// ENVIAR PEDIDO WHATSAPP COM ENDEREÇO
// ============================================
window.enviarPedidoWhatsApp = function() {
    const nome = document.getElementById('cli-nome').value.trim();
    const rua = document.getElementById('cli-rua').value.trim();
    const numero = document.getElementById('cli-numero').value.trim();
    const bairro = document.getElementById('cli-bairro').value.trim();
    const complemento = document.getElementById('cli-complemento').value.trim();
    const pagamento = document.getElementById('cli-pagamento').value;

    // Validação
    if (!nome || !rua || !numero || !bairro || !pagamento) {
        alert('Por favor, preencha todos os campos obrigatórios (*) antes de enviar.');
        return;
    }

    // Salva os dados no navegador para a próxima compra
    const dadosCliente = { nome, rua, numero, bairro, complemento };
    localStorage.setItem('cliente_hs', JSON.stringify(dadosCliente));

    let total = 0;
    
    // Monta a mensagem
    let mensagem = `*NOVO PEDIDO - CASA DE CARNE H&S*\n`;
    mensagem += `----------------------------------------\n\n`;
    mensagem += `*DADOS DO CLIENTE:*\n`;
    mensagem += `👤 Nome: ${nome}\n`;
    mensagem += `📍 Endereço: ${rua}, ${numero}\n`;
    mensagem += `🏘️ Bairro: ${bairro}\n`;
    if (complemento) mensagem += `🏠 Complemento: ${complemento}\n`;
    mensagem += `💳 Pagamento: ${pagamento}\n`;
    mensagem += `\n----------------------------------------\n\n`;
    mensagem += `*ITENS DO PEDIDO:*\n`;

    carrinho.forEach(item => {
        total += item.subtotal;
        const subtotalFmt = item.subtotal.toFixed(2).replace('.', ',');

        mensagem += `\n- *${item.nome}*\n`;
        mensagem += `  📦 Qtd: ${item.quantidadeExibir}\n`;
        
        if (item.tipoCorte) mensagem += `  ✂️ Corte: ${item.tipoCorte}\n`;
        if (item.observacao) mensagem += `  📝 Obs: ${item.observacao}\n`;
        
        mensagem += `  💵 Subtotal: R$ ${subtotalFmt}\n`;
    });

    mensagem += `\n----------------------------------------\n`;
    mensagem += `*TOTAL DO PEDIDO: R$ ${total.toFixed(2).replace('.', ',')}*\n`;
    mensagem += `----------------------------------------\n\n`;
    
    mensagem += `⚠️ _Lembrando: As carnes são vendidas por KG e podem sofrer variações de peso. O valor final será confirmado no atendimento._\n\n`;

    if (pagamento === 'PIX') {
        mensagem += `*PAGAMENTO VIA PIX*\n`;
        mensagem += `Chave PIX: *${CHAVE_PIX}*\n`;
        mensagem += `Favorecido: Casa de Carne H&S\n\n`;
        mensagem += `📸 *Após o pagamento, envie o comprovante nesta conversa para confirmarmos seu pedido!*\n`;
    }

    // Fecha o modal antes de abrir o WhatsApp
    bootstrap.Modal.getInstance(document.getElementById('modalEndereco')).hide();

    // Codifica e envia
    const url = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
}

// ============================================
// TOAST E INICIALIZAÇÃO
// ============================================
function mostrarToast(texto) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-100px);
        background: #25D366; color: #fff; padding: 12px 24px; border-radius: 30px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; font-weight: 600;
        font-size: 0.9rem; transition: transform 0.3s ease; white-space: nowrap;
    `;
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${texto}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.transform = 'translateX(-50%) translateY(20px)', 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(-100px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

document.addEventListener('DOMContentLoaded', function() {
    carregarDados();

    // Carrossel de Banners
    const carousel = document.getElementById('bannerCarousel');
    const dots = document.querySelectorAll('.banner-dots .dot');
    const items = document.querySelectorAll('.banner-item');
    
    if (carousel && items.length > 0) {
        let currentIndex = 0;
        let autoScrollInterval;

        function scrollToIndex(index) {
            const itemWidth = items[0].offsetWidth + 15; 
            carousel.scrollTo({ left: index * itemWidth, behavior: 'smooth' });
            updateDots(index);
        }

        function updateDots(index) {
            dots.forEach((dot, i) => {
                if (i === index) dot.classList.add('ativo');
                else dot.classList.remove('ativo');
            });
            currentIndex = index;
        }

        carousel.addEventListener('scroll', () => {
            const itemWidth = items[0].offsetWidth + 15;
            const newIndex = Math.round(carousel.scrollLeft / itemWidth);
            if (newIndex !== currentIndex && newIndex < items.length) {
                updateDots(newIndex);
            }
        });

        function startAutoScroll() {
            autoScrollInterval = setInterval(() => {
                let nextIndex = (currentIndex + 1) % items.length;
                scrollToIndex(nextIndex);
            }, 4000);
        }

        function stopAutoScroll() {
            clearInterval(autoScrollInterval);
        }

        startAutoScroll();

        carousel.addEventListener('touchstart', stopAutoScroll, { passive: true });
        carousel.addEventListener('mousedown', stopAutoScroll);
        carousel.addEventListener('touchend', () => { setTimeout(startAutoScroll, 5000); });
    }
});