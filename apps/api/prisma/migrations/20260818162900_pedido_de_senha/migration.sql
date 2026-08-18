-- CreateTable
CREATE TABLE "PedidoDeSenha" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoDeSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoDeSenha_userId_idx" ON "PedidoDeSenha"("userId");

-- AddForeignKey
ALTER TABLE "PedidoDeSenha" ADD CONSTRAINT "PedidoDeSenha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
