import assert from "node:assert/strict";
import { test } from "node:test";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { BoardCiStack } from "../lib/ci-stack.ts";

const template = Template.fromStack(new BoardCiStack(new App(), "Test-ci", { env: { account: "123456789012", region: "ap-northeast-1" }, repository: "owner/repo" }));

function trust(roleName: string): unknown {
    const roles = template.findResources("AWS::IAM::Role", { Properties: { RoleName: roleName } });
    const [role] = Object.values(roles) as { Properties: { AssumeRolePolicyDocument: { Statement: { Condition: unknown }[] } } }[];
    assert.ok(role, roleName);
    return role.Properties.AssumeRolePolicyDocument.Statement[0]?.Condition;
}

test("diff 用のロールは、このリポジトリの PR からだけ引き受けられ、lookup のロールだけを引き受けられる", () => {
    assert.deepEqual(trust("github-actions-board-diff"), {
        StringEquals: { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com", "token.actions.githubusercontent.com:sub": ["repo:owner/repo:pull_request"] },
    });
    template.hasResourceProperties("AWS::IAM::Policy", {
        Roles: [{ Ref: Match.stringLikeRegexp("DiffRole") }],
        PolicyDocument: {
            Statement: [{ Action: "sts:AssumeRole", Effect: "Allow", Resource: "arn:aws:iam::123456789012:role/cdk-hnb659fds-lookup-role-123456789012-ap-northeast-1" }],
        },
    });
});

test("デプロイ用のロールは、Environment（board-dev / production）からだけ引き受けられ、ブートストラップのロールだけを引き受けられる", () => {
    assert.deepEqual(trust("github-actions-board-deploy"), {
        StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
            "token.actions.githubusercontent.com:sub": ["repo:owner/repo:environment:board-dev", "repo:owner/repo:environment:production"],
        },
    });
    template.hasResourceProperties("AWS::IAM::Policy", {
        Roles: [{ Ref: Match.stringLikeRegexp("DeployRole") }],
        PolicyDocument: {
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    Resource: ["deploy", "file-publishing", "lookup"].map((name) => `arn:aws:iam::123456789012:role/cdk-hnb659fds-${name}-role-123456789012-ap-northeast-1`),
                },
            ],
        },
    });
});
