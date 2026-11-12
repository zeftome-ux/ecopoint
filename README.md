# EcoPoint

Plataforma para escolas incentivarem a reciclagem com pontos.

## Como rodar
Precisa apenas do Python 3 instalado (não precisa instalar mais nada).

```
cd ecopoint
python server.py
```

Abra http://localhost:8000

- Recriar o banco com dados fictícios: `python server.py --reset`
- Celulares na mesma rede Wi-Fi: use o endereço que aparece no terminal.

## Contas de teste (senha 123456)
| Perfil | Login |
|---|---|
| Aluno | aluno@ecopoint.com (matrícula 2026001) |
| Funcionário | funcionario@ecopoint.com |
| Administrador | admin@ecopoint.com |

## Arquivos
- `server.py`: servidor e API (regras de pontos, desafios, conquistas e antifraude)
- `db.py`: banco SQLite e dados fictícios
- `static/`: interface (HTML, CSS e JS)
- `static/respiracao.html`: simulação interativa "Mecânica da Respiração" (Lei de Boyle). Com o servidor rodando, abra http://localhost:8000/respiracao.html. Também funciona abrindo o arquivo direto no navegador.
  - `static/respiracao/model.js`: modelo matemático (P₁·V₁ = P₂·V₂) e motor da animação
  - `static/respiracao/anatomy.js`: anatomia em SVG gerada a partir do mesmo modelo
  - `static/respiracao/quiz.js`: modo "Experimente você mesmo"
  - `static/respiracao/app.js`: interface, controles e sincronização
