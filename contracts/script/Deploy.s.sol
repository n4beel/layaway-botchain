// SPDX-License-Identifier: MIT
pragma solidity 0.8.23;

import {Script} from "forge-std/Script.sol";
import {Layaway} from "../src/Layaway.sol";

contract DeployScript is Script {
  function run() external returns (Layaway layaway) {
    vm.startBroadcast();
    layaway = new Layaway();
    vm.stopBroadcast();
  }
}
