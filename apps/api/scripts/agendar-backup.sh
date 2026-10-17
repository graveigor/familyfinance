#!/bin/bash
# Agenda o backup diário do banco de produção no launchd do macOS.
#
# O launchd foi escolhido em vez do cron porque ele recupera a execução perdida
# enquanto o Mac DORME: acordou, roda. Atenção ao limite — com o Mac
# DESLIGADO na hora marcada, nem ele recupera, e aquele dia fica sem backup.
# (Daí o aviso na tela quando o backup falha: é a única coisa que não deixa um
# problema passar semanas despercebido.)
#
#   bash apps/api/scripts/agendar-backup.sh           # liga (21h todo dia)
#   bash apps/api/scripts/agendar-backup.sh --hora 9  # outro horário
#   bash apps/api/scripts/agendar-backup.sh --desligar
#
# O log de cada execução fica em ~/Backups/family-finance/backup.log.

set -euo pipefail

ROTULO="com.graveigor.familyfinance.backup"
PLIST="$HOME/Library/LaunchAgents/$ROTULO.plist"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$RAIZ/apps/api/scripts/backup.mjs"
LOGS="$HOME/Backups/family-finance"
HORA=21

while [ $# -gt 0 ]; do
  case "$1" in
    --hora)
      HORA="${2:-}"
      # Sem isto, `--hora amanha` vira <integer>amanha</integer>: o launchd
      # recusa o plist, o `set -e` mata o script em silêncio — e o job antigo
      # já foi descarregado logo acima. Ficaria sem backup nenhum.
      [[ "$HORA" =~ ^([0-9]|1[0-9]|2[0-3])$ ]] || {
        echo "✖ --hora precisa ser um número inteiro de 0 a 23."
        exit 1
      }
      shift 2
      ;;
    --desligar)
      launchctl bootout "gui/$(id -u)/$ROTULO" 2>/dev/null || true
      rm -f "$PLIST"
      echo "Backup automático desligado. O script continua podendo rodar à mão."
      exit 0
      ;;
    *) echo "Não conheço a opção $1"; exit 1 ;;
  esac
done

if [ ! -f "$RAIZ/apps/api/.env.backup.local" ]; then
  echo "✖ Falta o arquivo apps/api/.env.backup.local com a DATABASE_URL_BACKUP."
  echo "  Sem ele o agendamento rodaria todo dia só para falhar."
  exit 1
fi

# O caminho do node precisa ser absoluto: o launchd roda com um PATH mínimo,
# sem Homebrew e sem nvm. Essa é a causa clássica de "o agendamento não roda e
# não diz por quê".
NODE="$(command -v node)" || {
  echo "✖ Não achei o node no PATH."
  exit 1
}

mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
# O dump e o log têm dado financeiro em claro (valor, data, categoria, quem
# gastou). O `mkdir` respeita o umask, que costuma deixar 0755.
chmod 700 "$LOGS"

cat > "$PLIST" <<PLISTFIM
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ROTULO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$SCRIPT</string>
  </array>
  <key>WorkingDirectory</key><string>$RAIZ</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HORA</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <!-- Falso de propósito: verdadeiro faria rodar um backup a cada login. -->
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$LOGS/backup.log</string>
  <key>StandardErrorPath</key><string>$LOGS/backup.log</string>
</dict>
</plist>
PLISTFIM

launchctl bootout "gui/$(id -u)/$ROTULO" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "✓ Backup agendado para as ${HORA}h, todo dia."
case "$NODE" in
  *.nvm*)
    echo
    echo "  Atenção: este node é do nvm, e o caminho gravado no agendamento é o"
    echo "  da versão de agora ($NODE)."
    echo "  Se você trocar ou remover essa versão, rode este script de novo —"
    echo "  senão o backup passa a falhar todo dia apontando para um binário"
    echo "  que não existe mais."
    echo
    ;;
esac
echo "  Log:      $LOGS/backup.log"
echo "  Rodar já: launchctl kickstart -p gui/$(id -u)/$ROTULO"
echo "  Desligar: bash apps/api/scripts/agendar-backup.sh --desligar"
