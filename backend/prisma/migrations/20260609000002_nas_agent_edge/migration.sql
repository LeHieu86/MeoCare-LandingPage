-- Edge recording: token xác thực + tailnet host cho mỗi chi nhánh
ALTER TABLE "nas_config" ADD COLUMN "agent_token" TEXT;
ALTER TABLE "nas_config" ADD COLUMN "tailnet_host" TEXT;

-- agent_token là bí mật duy nhất mỗi chi nhánh
CREATE UNIQUE INDEX "nas_config_agent_token_key" ON "nas_config"("agent_token");
