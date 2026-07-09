document.getElementById('btnProcessar').addEventListener('click', async () => {
  const input = document.getElementById('notasInput').value;
  const status = document.getElementById('status');
  const habilitarNC = document.getElementById('chkNC').checked; // Lê o status do checkbox

  if (!input.trim()) {
    status.textContent = "Por favor, cole os dados primeiro.";
    status.style.color = "red";
    return;
  }

  status.textContent = "Processando... aguarde.";
  status.style.color = "orange";

  // Captura a aba ativa no Chrome
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Injeta a função processarNotasNoDom na página, passando a string de notas E a opção de N/C
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: processarNotasNoDom,
    args: [input, habilitarNC] 
  }, (results) => {
     if (chrome.runtime.lastError) {
         status.textContent = "Erro: Você está na página correta do SAV?";
         status.style.color = "red";
     } else {
         status.textContent = "Lançamento concluído!";
         status.style.color = "green";
     }
  });
});

// =====================================================================
// ATENÇÃO: Esta função roda dentro do contexto da página da universidade
// =====================================================================
async function processarNotasNoDom(notasString, habilitarNC) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pares = notasString.split(';').map(p => p.trim()).filter(p => p !== '');
  let notasAtualizadas = 0;

  for (const par of pares) {
    const [ra, notaBruta] = par.split('&');
    if (!ra || !notaBruta) continue;
    
    const nota = notaBruta.trim();
    
    // Agora o isNC só é verdadeiro se a nota for zero E o checkbox estiver marcado
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
          // Cenário 1: Nota zero e a opção de N/C está habilitada no popup
          if (!checkboxNC.checked) {
            checkboxNC.checked = true;
            checkboxNC.dispatchEvent(new Event('change', { bubbles: true }));
            notasAtualizadas++;
            await sleep(400); 
          }
        } else {
          // Cenário 2: Qualquer outra nota, OU nota zero com a opção de N/C desabilitada no popup
          
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
  
  alert(`Finalizado! ${notasAtualizadas} aluno(s) processado(s) com sucesso na tabela.`);
}