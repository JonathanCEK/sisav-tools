// =====================================================================
// LÓGICA DO POPUP (INTERFACE)
// =====================================================================

document.querySelectorAll('input[name="modo"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
      const isNotas = e.target.value === 'notas';
      
      document.getElementById('opcoesNotas').style.display = isNotas ? 'flex' : 'none';
      
      document.getElementById('dadosInput').placeholder = isNotas
          ? "149079&10.0;\n149069&0,0;"
          : "08/07/2026&04/07/2026;\n3&4;\n108665&3&4;\n143053&1&3;\n143630&0&0;";
          
      document.getElementById('hintTexto').textContent = isNotas
          ? "Formato: RA&Nota; (Tudo finalizado por ;)"
          : "Datas; Aulas; RA&f1&f2... (Separados por & e finalizados por ;)";
          
      document.getElementById('btnProcessar').textContent = isNotas
          ? "Injetar Notas na Tabela"
          : "Injetar Faltas na Tabela";
  });
});

document.getElementById('btnProcessar').addEventListener('click', async () => {
  const input = document.getElementById('dadosInput').value;
  const status = document.getElementById('status');
  const modo = document.querySelector('input[name="modo"]:checked').value;

  if (!input.trim()) {
    status.textContent = "Por favor, cole os dados primeiro.";
    status.style.color = "red";
    return;
  }

  status.textContent = "Processando... não feche a aba do SAV.";
  status.style.color = "orange";

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (modo === 'notas') {
    const habilitarNC = document.getElementById('chkNC').checked;
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: processarNotasNoDom,
      args: [input, habilitarNC] 
    }, handleResult);
  } else {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: processarFaltasNoDom,
      args: [input] 
    }, handleResult);
  }

  function handleResult(results) {
     if (chrome.runtime.lastError) {
         status.textContent = "Erro: A página do SAV está ativa?";
         status.style.color = "red";
     }
  }
});


// =====================================================================
// FUNÇÕES INJETADAS NA PÁGINA DA UNIVERSIDADE
// =====================================================================

// Função 1: Lançamento de Notas (Mesma de antes)
async function processarNotasNoDom(notasString, habilitarNC) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pares = notasString.split(';').map(p => p.trim()).filter(p => p !== '');
  let notasAtualizadas = 0;

  for (const par of pares) {
    const [ra, notaBruta] = par.split('&');
    if (!ra || !notaBruta) continue;
    
    const nota = notaBruta.trim();
    const isNC = habilitarNC && (nota === "0,0" || nota === "0.0");
    const celulasRA = document.querySelectorAll('td[data-label="RA: "]');
    let linhaDoAluno = null;

    for (const td of celulasRA) {
      if (td.textContent.trim() === ra.trim()) {
        linhaDoAluno = td.closest('tr');
        break;
      }
    }

    if (linhaDoAluno) {
      const inputNota = linhaDoAluno.querySelector('input[name="nota"]');
      const checkboxNC = linhaDoAluno.querySelector('input[name="nc"]');
      
      if (inputNota && checkboxNC) {
        if (isNC) {
          if (!checkboxNC.checked) {
            checkboxNC.checked = true;
            checkboxNC.dispatchEvent(new Event('change', { bubbles: true }));
            notasAtualizadas++;
            await sleep(400); 
          }
        } else {
          if (checkboxNC.checked) {
            checkboxNC.checked = false;
            checkboxNC.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(300); 
          }
          inputNota.value = nota;
          inputNota.dispatchEvent(new Event('input', { bubbles: true }));
          inputNota.dispatchEvent(new Event('change', { bubbles: true }));
          inputNota.dispatchEvent(new Event('blur', { bubbles: true }));

          notasAtualizadas++;
          await sleep(400); 
        }
      }
    }
  }
  alert(`Finalizado! ${notasAtualizadas} nota(s) processada(s) com sucesso.`);
}

// Função 2: Lançamento de Faltas (ATUALIZADA)
async function processarFaltasNoDom(dadosString) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  // Divide as linhas pelo ponto e vírgula
  const linhas = dadosString.trim().split(';').map(l => l.trim()).filter(l => l !== '');

  if (linhas.length < 3) {
      alert("Erro: Formato inválido. Certifique-se de usar ; no final de cada linha.");
      return;
  }

  // Lê as datas e quantidades da linha 1 e 2 separando pelo "&"
  let datas = linhas[0].split('&').map(d => d.trim());
  let qntAulas = linhas[1].split('&').map(q => q.trim());
  
  // Limpeza de arrays caso o usuário deixe um "&" perdido no final
  if(datas[datas.length - 1] === "") datas.pop();
  if(qntAulas[qntAulas.length - 1] === "") qntAulas.pop();

  if (datas.length !== qntAulas.length) {
      alert(`Erro: Quantidade de datas (${datas.length}) não bate com quantidade de aulas (${qntAulas.length}).`);
      return;
  }

  let faltasLancadas = 0;
  let diasProcessados = 0;

  // Itera por cada data na ordem em que foi passada
  for (let i = 0; i < datas.length; i++) {
      // LÓGICA DO RODÍZIO: Pega o resto da divisão por 6. Resulta num ciclo: 1,2,3,4,5,6,1,2,3...
      const colIndex = (i % 6) + 1; 
      
      const dataAtual = datas[i];
      const aulaAtual = qntAulas[i];

      // 1. Preenche a Data
      const campoData = document.getElementById(`calendario${colIndex}`);
      if (campoData) {
          campoData.value = dataAtual;
          campoData.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(1500); // Aguarda SAV validar data no banco
      } else {
          continue; // Pula se houver algum erro de layout na tela
      }

      // 2. Preenche a Qnt. Aulas
      const campoAulas = document.getElementById(`diaAula-${colIndex}`);
      if (campoAulas) {
          campoAulas.value = aulaAtual;
          campoAulas.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(1000); // Aguarda SAV habilitar os inputs de faltas
      }

      // 3. Lê os alunos e preenche
      for (let j = 2; j < linhas.length; j++) {
          const dadosAluno = linhas[j].split('&').map(d => d.trim());
          const raAluno = dadosAluno[0];
          
          // Pega a falta baseada no índice do dia + 1 (pois o índice 0 é o RA)
          const faltaDoAluno = dadosAluno[i + 1]; 

          // Trava de segurança: Se for zero ou em branco, ignora o aluno neste dia
          if (!raAluno || faltaDoAluno === undefined || faltaDoAluno === "" || faltaDoAluno === "0") {
              continue; 
          }

          const celulasTabela = document.querySelectorAll('#tabelaAlunos tbody td:first-child');
          let linhaAluno = null;

          for (const td of celulasTabela) {
              if (td.textContent.trim() === raAluno) {
                  linhaAluno = td.closest('tr');
                  break;
              }
          }

          if (linhaAluno) {
              const inputFalta = linhaAluno.querySelector(`.faltas-${colIndex}`);
              
              if (inputFalta && !inputFalta.disabled) {
                  inputFalta.value = faltaDoAluno;
                  inputFalta.dispatchEvent(new Event('input', { bubbles: true }));
                  inputFalta.dispatchEvent(new Event('change', { bubbles: true }));
                  inputFalta.dispatchEvent(new Event('blur', { bubbles: true }));

                  faltasLancadas++;
                  await sleep(400); // Aguarda SAV salvar a falta no banco
              }
          }
      }
      diasProcessados++;
  }
  
  alert(`Finalizado! ${diasProcessados} dia(s) processado(s) e ${faltasLancadas} registro(s) de falta inserido(s).`);
}