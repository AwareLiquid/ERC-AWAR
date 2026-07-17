// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Demo} from "../../script/Demo.s.sol";

/// @dev Runs the end-to-end demo script so it stays compiled and green in CI.
///      See full output with: `forge test --match-contract DemoTest -vv`.
contract DemoTest is Test {
    function test_EndToEndLifecycle() public {
        new Demo().run();
    }
}
