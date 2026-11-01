import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { OpenIdConnectProvider, PolicyStatement, Role, WebIdentityPrincipal } from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

// GitHub Actions がボードのスタックを diff / デプロイするための IAM ロール（Issue #259）
// このスタックは CI からはデプロイせず、管理者が手でデプロイする（CI が自分の権限を広げられないように）
export interface BoardCiStackProps extends StackProps {
    // owner/repo
    readonly repository: string;
    // CDK のブートストラップの qualifier（既定値のまま）
    readonly qualifier?: string;
}

const TOKEN_HOST = "token.actions.githubusercontent.com";

export class BoardCiStack extends Stack {
    constructor(scope: Construct, id: string, props: BoardCiStackProps) {
        super(scope, id, props);

        const qualifier = props.qualifier ?? "hnb659fds";
        // OIDC プロバイダーは EC2 へのデプロイ（deploy.yml）用に作ってあるものを使う
        const provider = OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, "GitHub", `arn:aws:iam::${this.account}:oidc-provider/${TOKEN_HOST}`);
        const principal = (subjects: string[]) =>
            new WebIdentityPrincipal(provider.openIdConnectProviderArn, {
                StringEquals: { [`${TOKEN_HOST}:aud`]: "sts.amazonaws.com", [`${TOKEN_HOST}:sub`]: subjects },
            });
        const bootstrapRole = (name: string) => `arn:aws:iam::${this.account}:role/cdk-${qualifier}-${name}-role-${this.account}-${this.region}`;

        // PR の diff 用：読み取りだけのブートストラップのロール（lookup）を引き受けられる
        // フォークからの PR・Dependabot の PR には OIDC のトークンが渡らないため、引き受けられるのはこのリポジトリのブランチからの PR だけ
        const diffRole = new Role(this, "DiffRole", {
            roleName: "github-actions-board-diff",
            assumedBy: principal([`repo:${props.repository}:pull_request`]),
            maxSessionDuration: Duration.hours(1),
        });
        diffRole.addToPolicy(new PolicyStatement({ actions: ["sts:AssumeRole"], resources: [bootstrapRole("lookup")] }));

        // デプロイ用：GitHub の Environment（board-dev / production）のジョブからだけ引き受けられる
        // どのブランチから動かせるか・承認が要るかは、Environment の設定で決める
        const deployRole = new Role(this, "DeployRole", {
            roleName: "github-actions-board-deploy",
            assumedBy: principal([`repo:${props.repository}:environment:board-dev`, `repo:${props.repository}:environment:production`]),
            maxSessionDuration: Duration.hours(1),
        });
        deployRole.addToPolicy(
            new PolicyStatement({
                actions: ["sts:AssumeRole"],
                resources: [bootstrapRole("deploy"), bootstrapRole("file-publishing"), bootstrapRole("lookup")],
            }),
        );

        new CfnOutput(this, "DiffRoleArn", { value: diffRole.roleArn });
        new CfnOutput(this, "DeployRoleArn", { value: deployRole.roleArn });
    }
}
